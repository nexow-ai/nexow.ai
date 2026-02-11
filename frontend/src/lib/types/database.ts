export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
          timeframe: string;
          status: "active" | "paused" | "killed";
          max_drawdown_pct: number;
          risk_per_trade_pct: number;
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
          timeframe?: string;
          status?: "active" | "paused" | "killed";
          max_drawdown_pct?: number;
          risk_per_trade_pct?: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          type?: "systematic" | "discretionary";
          config?: Json;
          prompt?: string | null;
          instrument?: string;
          timeframe?: string;
          status?: "active" | "paused" | "killed";
          max_drawdown_pct?: number;
          risk_per_trade_pct?: number;
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
  };
};
