#!/usr/bin/env bash
#
# One-time AWS setup for Nexow.io
#
# Prerequisites:
#   - AWS CLI v2 installed and configured (aws configure)
#   - Your .env file filled with real values
#
# Usage:
#   chmod +x infra/setup-aws.sh
#   ./infra/setup-aws.sh
#
# After running this script you need to:
#   1. Connect your GitHub repo to AWS Amplify via the AWS Console
#      (Amplify > New app > Host web app > GitHub > select repo > branch: main)
#      Set the build spec to use the amplify.yml at the repo root.
#      Add these env vars in Amplify console:
#        NEXT_PUBLIC_SUPABASE_URL
#        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
#
#   2. Create an OIDC identity provider for GitHub Actions in IAM:
#      Provider URL : https://token.actions.githubusercontent.com
#      Audience     : sts.amazonaws.com
#      Then create the IAM role (nexow-github-actions-role) that trusts it,
#      and store its ARN as a GitHub Actions secret called AWS_ROLE_ARN.
#
#   3. Replace every ACCOUNT_ID in infra/task-definition.json with your
#      real AWS account ID (output at the end of this script).

set -euo pipefail

REGION="eu-west-1"
CLUSTER_NAME="nexow"
SERVICE_NAME="nexow-engine"
ECR_REPO="nexow-engine"
LOG_GROUP="/ecs/nexow-engine"
SSM_PREFIX="/nexow"

echo "==> AWS Account"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "    Account ID: $ACCOUNT_ID"
echo "    Region:     $REGION"

# ── 1. ECR Repository ────────────────────────────────────────────────
echo ""
echo "==> Creating ECR repository: $ECR_REPO"
aws ecr create-repository \
  --repository-name "$ECR_REPO" \
  --region "$REGION" \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  2>/dev/null || echo "    (already exists)"

# ── 2. CloudWatch Log Group ──────────────────────────────────────────
echo ""
echo "==> Creating CloudWatch log group: $LOG_GROUP"
aws logs create-log-group \
  --log-group-name "$LOG_GROUP" \
  --region "$REGION" \
  2>/dev/null || echo "    (already exists)"

aws logs put-retention-policy \
  --log-group-name "$LOG_GROUP" \
  --retention-in-days 14 \
  --region "$REGION"

# ── 3. SSM Parameters (from .env) ───────────────────────────────────
echo ""
echo "==> Storing secrets in SSM Parameter Store"
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  echo "    ERROR: .env file not found. Copy .env.example to .env and fill values."
  exit 1
fi

PARAMS=(
  SUPABASE_URL
  SUPABASE_PUBLISHABLE_KEY
  SUPABASE_SECRET_KEY
  OANDA_API_URL
  OANDA_ACCOUNT_ID
  OANDA_API_TOKEN
  OPENAI_API_KEY
  ANTHROPIC_API_KEY
  TAVILY_API_KEY
)

for KEY in "${PARAMS[@]}"; do
  VALUE=$(grep "^${KEY}=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
  if [ -z "$VALUE" ]; then
    echo "    SKIP: $KEY (empty or missing in .env)"
    continue
  fi
  aws ssm put-parameter \
    --name "${SSM_PREFIX}/${KEY}" \
    --value "$VALUE" \
    --type SecureString \
    --overwrite \
    --region "$REGION" \
    > /dev/null
  echo "    OK: ${SSM_PREFIX}/${KEY}"
done

# ── 4. IAM Roles ────────────────────────────────────────────────────
echo ""
echo "==> Creating ECS execution role: nexow-engine-execution-role"

EXEC_TRUST_POLICY=$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
POLICY
)

aws iam create-role \
  --role-name nexow-engine-execution-role \
  --assume-role-policy-document "$EXEC_TRUST_POLICY" \
  2>/dev/null || echo "    (already exists)"

aws iam attach-role-policy \
  --role-name nexow-engine-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  2>/dev/null || true

INLINE_POLICY=$(cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["ssm:GetParameters"],
    "Resource": "arn:aws:ssm:${REGION}:${ACCOUNT_ID}:parameter${SSM_PREFIX}/*"
  }]
}
POLICY
)

aws iam put-role-policy \
  --role-name nexow-engine-execution-role \
  --policy-name nexow-ssm-read \
  --policy-document "$INLINE_POLICY"

echo "==> Creating ECS task role: nexow-engine-task-role"
aws iam create-role \
  --role-name nexow-engine-task-role \
  --assume-role-policy-document "$EXEC_TRUST_POLICY" \
  2>/dev/null || echo "    (already exists)"

# ── 5. ECS Cluster ──────────────────────────────────────────────────
echo ""
echo "==> Creating ECS cluster: $CLUSTER_NAME"
aws ecs create-cluster \
  --cluster-name "$CLUSTER_NAME" \
  --region "$REGION" \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  > /dev/null 2>&1 || echo "    (already exists)"

# ── 6. Patch task-definition.json with real account ID ───────────────
echo ""
echo "==> Patching infra/task-definition.json with account ID: $ACCOUNT_ID"
if [ -f "infra/task-definition.json" ]; then
  sed -i "s/ACCOUNT_ID/${ACCOUNT_ID}/g" infra/task-definition.json
  echo "    Done."
else
  echo "    WARN: infra/task-definition.json not found."
fi

# ── 7. Register task definition & create service ────────────────────
echo ""
echo "==> Registering ECS task definition"
aws ecs register-task-definition \
  --cli-input-json file://infra/task-definition.json \
  --region "$REGION" \
  > /dev/null

echo ""
echo "==> Creating ECS service: $SERVICE_NAME"
echo "    NOTE: You need a VPC with subnets and a security group."
echo "    Replace <SUBNET_ID> and <SG_ID> below, then run manually:"
echo ""
echo "    aws ecs create-service \\"
echo "      --cluster $CLUSTER_NAME \\"
echo "      --service-name $SERVICE_NAME \\"
echo "      --task-definition nexow-engine \\"
echo "      --desired-count 1 \\"
echo "      --launch-type FARGATE \\"
echo "      --network-configuration 'awsvpcConfiguration={subnets=[<SUBNET_ID>],securityGroups=[<SG_ID>],assignPublicIp=ENABLED}' \\"
echo "      --region $REGION"

echo ""
echo "============================================"
echo "  Setup complete!"
echo "  Account ID: $ACCOUNT_ID"
echo "  Region:     $REGION"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Connect GitHub repo to AWS Amplify (console)"
echo "  2. Set up GitHub OIDC + IAM role for Actions (see comments at top)"
echo "  3. Run the ECS create-service command above with your VPC details"
echo "  4. Push to main and watch both deploys run"
