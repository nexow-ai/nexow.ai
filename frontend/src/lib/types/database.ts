export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface InstrumentConfig {
  instrument: string;
  timeframe: string;
}

export interface ExitConfig {
  stop_loss_pct?: number;
  take_profit_pct?: number;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
      };
      agents: {
        Row: {
          id: string;
          creator_id: string;
          name: string;
          description: string | null;
          type: "systematic" | "discretionary";
          config: Json;
          prompt: string | null;
          instrument: string;
          instruments: InstrumentConfig[];
          timeframe: string;
          status: "active" | "paused" | "killed";
          llm_provider: string;
          llm_model: string;
          evaluation_schedule: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          creator_id: string;
          name: string;
          description?: string | null;
          type?: "systematic" | "discretionary";
          config?: Json;
          prompt?: string | null;
          instrument?: string;
          instruments?: InstrumentConfig[];
          timeframe?: string;
          status?: "active" | "paused" | "killed";
          llm_provider?: string;
          llm_model?: string;
          evaluation_schedule?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          type?: "systematic" | "discretionary";
          config?: Json;
          prompt?: string | null;
          instrument?: string;
          instruments?: InstrumentConfig[];
          timeframe?: string;
          status?: "active" | "paused" | "killed";
          llm_provider?: string;
          llm_model?: string;
          evaluation_schedule?: string;
        };
      };
      trades: {
        Row: {
          id: string;
          agent_id: string;
          instrument: string;
          direction: "buy" | "sell";
          entry_price: number;
          exit_price: number | null;
          return_pct: number | null;
          stop_loss_pct: number | null;
          take_profit_pct: number | null;
          status: "open" | "closed";
          opened_at: string;
          closed_at: string | null;
        };
        Insert: {
          agent_id: string;
          instrument: string;
          direction: "buy" | "sell";
          entry_price: number;
          status?: "open" | "closed";
          stop_loss_pct?: number | null;
          take_profit_pct?: number | null;
        };
        Update: {
          status?: "open" | "closed";
          exit_price?: number | null;
          return_pct?: number | null;
          closed_at?: string | null;
        };
      };
      agent_performance: {
        Row: {
          agent_id: string;
          total_trades: number;
          winning_trades: number;
          win_rate: number;
          total_return_pct: number;
          avg_return_pct: number;
          max_drawdown: number;
          sharpe_ratio: number;
          updated_at: string;
        };
        Insert: {
          agent_id: string;
          total_trades?: number;
          winning_trades?: number;
          win_rate?: number;
          total_return_pct?: number;
          avg_return_pct?: number;
          max_drawdown?: number;
          sharpe_ratio?: number;
        };
        Update: {
          total_trades?: number;
          winning_trades?: number;
          win_rate?: number;
          total_return_pct?: number;
          avg_return_pct?: number;
          max_drawdown?: number;
          sharpe_ratio?: number;
        };
      };
      copy_subscriptions: {
        Row: {
          id: string;
          copier_id: string;
          agent_id: string;
          allocation_pct: number;
          status: "active" | "paused";
          created_at: string;
        };
        Insert: {
          copier_id: string;
          agent_id: string;
          allocation_pct?: number;
          status?: "active" | "paused";
        };
        Update: {
          allocation_pct?: number;
          status?: "active" | "paused";
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: "free" | "starter" | "pro" | "elite";
          status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          tier?: "free" | "starter" | "pro" | "elite";
          status?: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        };
        Update: {
          tier?: "free" | "starter" | "pro" | "elite";
          status?: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
        };
      };
      ai_credits: {
        Row: {
          id: string;
          user_id: string;
          credits_limit: number;
          credits_used: number;
          period_start: string;
          period_end: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          credits_limit?: number;
          credits_used?: number;
          period_start?: string;
          period_end?: string;
        };
        Update: {
          credits_limit?: number;
          credits_used?: number;
          period_start?: string;
          period_end?: string;
        };
      };
      credit_usage_log: {
        Row: {
          id: string;
          user_id: string;
          agent_id: string | null;
          action: string;
          credits_used: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          agent_id?: string | null;
          action: string;
          credits_used: number;
          description?: string | null;
        };
        Update: {
          action?: string;
          credits_used?: number;
          description?: string | null;
        };
      };
      agent_logs: {
        Row: {
          id: string;
          agent_id: string;
          level: string;
          message: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          agent_id: string;
          level?: string;
          message: string;
          metadata?: Json;
        };
        Update: {
          level?: string;
          message?: string;
          metadata?: Json;
        };
      };
    };
    Functions: {
      check_username_available: {
        Args: { desired_username: string };
        Returns: boolean;
      };
      consume_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_action: string;
          p_agent_id?: string | null;
          p_description?: string | null;
        };
        Returns: boolean;
      };
      reset_user_credits: {
        Args: {
          p_user_id: string;
          p_new_limit: number;
          p_period_start: string;
          p_period_end: string;
        };
        Returns: void;
      };
    };
  };
};
