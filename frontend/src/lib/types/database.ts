export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface InstrumentAllocation {
  instrument: string;
  allocation_pct: number;
  timeframe: string;
}

export interface RiskConfig {
  risk_per_trade_pct?: number;
  max_position_size_pct?: number;
  max_drawdown_pct?: number;
  max_daily_loss_pct?: number;
  stop_loss_mode?: "fixed_pips" | "atr_based" | "trailing" | "none";
  stop_loss_pips?: number | null;
  stop_loss_atr_multiplier?: number;
  trailing_stop_pips?: number | null;
  take_profit_mode?: "fixed_pips" | "risk_reward" | "atr_based" | "none";
  take_profit_pips?: number | null;
  risk_reward_ratio?: number;
  take_profit_atr_multiplier?: number;
  max_concurrent_trades?: number;
  max_correlated_exposure_pct?: number;
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
          instruments: InstrumentAllocation[];
          timeframe: string;
          status: "active" | "paused" | "killed";
          max_drawdown_pct: number;
          risk_per_trade_pct: number;
          risk_config: RiskConfig;
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
          instruments?: InstrumentAllocation[];
          timeframe?: string;
          status?: "active" | "paused" | "killed";
          max_drawdown_pct?: number;
          risk_per_trade_pct?: number;
          risk_config?: RiskConfig;
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
          instruments?: InstrumentAllocation[];
          timeframe?: string;
          status?: "active" | "paused" | "killed";
          max_drawdown_pct?: number;
          risk_per_trade_pct?: number;
          risk_config?: RiskConfig;
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
          quantity: number;
          pnl: number | null;
          status: "open" | "closed";
          oanda_trade_id: string | null;
          is_copy: boolean;
          master_trade_id: string | null;
          opened_at: string;
          closed_at: string | null;
        };
        Insert: {
          agent_id: string;
          instrument: string;
          direction: "buy" | "sell";
          entry_price: number;
          quantity: number;
          status?: "open" | "closed";
          oanda_trade_id?: string | null;
          is_copy?: boolean;
          master_trade_id?: string | null;
        };
        Update: {
          status?: "open" | "closed";
          exit_price?: number | null;
          pnl?: number | null;
          closed_at?: string | null;
        };
      };
      agent_performance: {
        Row: {
          agent_id: string;
          total_trades: number;
          winning_trades: number;
          win_rate: number;
          total_pnl: number;
          max_drawdown: number;
          sharpe_ratio: number;
          roi_pct: number;
          updated_at: string;
        };
        Insert: {
          agent_id: string;
          total_trades?: number;
          winning_trades?: number;
          win_rate?: number;
          total_pnl?: number;
          max_drawdown?: number;
          sharpe_ratio?: number;
          roi_pct?: number;
        };
        Update: {
          total_trades?: number;
          winning_trades?: number;
          win_rate?: number;
          total_pnl?: number;
          max_drawdown?: number;
          sharpe_ratio?: number;
          roi_pct?: number;
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
    };
    Functions: {
      check_username_available: {
        Args: { desired_username: string };
        Returns: boolean;
      };
    };
  };
};
