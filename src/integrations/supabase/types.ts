export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_decisions: {
        Row: {
          action: string
          asset: string
          confidence: number | null
          context: Json | null
          created_at: string
          id: string
          outcome: string | null
          rationale: string | null
          regime: string | null
          user_id: string
        }
        Insert: {
          action: string
          asset: string
          confidence?: number | null
          context?: Json | null
          created_at?: string
          id?: string
          outcome?: string | null
          rationale?: string | null
          regime?: string | null
          user_id: string
        }
        Update: {
          action?: string
          asset?: string
          confidence?: number | null
          context?: Json | null
          created_at?: string
          id?: string
          outcome?: string | null
          rationale?: string | null
          regime?: string | null
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          active: boolean
          asset_name: string
          condition: string
          created_at: string
          id: string
          symbol: string
          target_price: number
          triggered_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          asset_name: string
          condition: string
          created_at?: string
          id?: string
          symbol: string
          target_price: number
          triggered_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          asset_name?: string
          condition?: string
          created_at?: string
          id?: string
          symbol?: string
          target_price?: number
          triggered_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      alerts_fired: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          details: Json
          id: string
          notified: boolean
          rule_key: string
          severity: string
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          details?: Json
          id?: string
          notified?: boolean
          rule_key: string
          severity: string
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          details?: Json
          id?: string
          notified?: boolean
          rule_key?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          created_at: string
          email: string | null
          error_message: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      autonomous_sessions: {
        Row: {
          ending_equity: number | null
          id: string
          metadata: Json | null
          mode: string
          started_at: string
          starting_equity: number | null
          status: string
          stop_reason: string | null
          stopped_at: string | null
          strategy: string | null
          user_id: string
        }
        Insert: {
          ending_equity?: number | null
          id?: string
          metadata?: Json | null
          mode?: string
          started_at?: string
          starting_equity?: number | null
          status?: string
          stop_reason?: string | null
          stopped_at?: string | null
          strategy?: string | null
          user_id: string
        }
        Update: {
          ending_equity?: number | null
          id?: string
          metadata?: Json | null
          mode?: string
          started_at?: string
          starting_equity?: number | null
          status?: string
          stop_reason?: string | null
          stopped_at?: string | null
          strategy?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bank_account_secrets: {
        Row: {
          bank_account_id: string
          created_at: string
          id: string
          plaid_access_token: string | null
          plaid_item_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_id: string
          created_at?: string
          id?: string
          plaid_access_token?: string | null
          plaid_item_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_id?: string
          created_at?: string
          id?: string
          plaid_access_token?: string | null
          plaid_item_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_id: string | null
          account_mask: string | null
          account_name: string | null
          account_type: string | null
          created_at: string
          currency: string | null
          id: string
          institution_name: string | null
          is_active: boolean
          provider: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          account_mask?: string | null
          account_name?: string | null
          account_type?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          institution_name?: string | null
          is_active?: boolean
          provider?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          account_mask?: string | null
          account_name?: string | null
          account_type?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          institution_name?: string | null
          is_active?: boolean
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      broker_credentials: {
        Row: {
          auth_tag: string
          broker: string
          created_at: string
          encrypted_api_key: string
          encrypted_api_secret: string
          id: string
          is_active: boolean
          iv: string
          label: string | null
          mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_tag: string
          broker?: string
          created_at?: string
          encrypted_api_key: string
          encrypted_api_secret: string
          id?: string
          is_active?: boolean
          iv: string
          label?: string | null
          mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_tag?: string
          broker?: string
          created_at?: string
          encrypted_api_key?: string
          encrypted_api_secret?: string
          id?: string
          is_active?: boolean
          iv?: string
          label?: string | null
          mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      disclaimer_acceptances: {
        Row: {
          accepted_at: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      email_rate_limit: {
        Row: {
          category: string
          count: number
          created_at: string
          id: string
          recipient: string
          user_id: string | null
          window_start: string
        }
        Insert: {
          category: string
          count?: number
          created_at?: string
          id?: string
          recipient: string
          user_id?: string | null
          window_start?: string
        }
        Update: {
          category?: string
          count?: number
          created_at?: string
          id?: string
          recipient?: string
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      execution_history: {
        Row: {
          broker: string
          created_at: string
          id: string
          metadata: Json | null
          mode: string
          order_id: string | null
          pnl: number | null
          price: number | null
          quantity: number
          side: string
          slippage_pct: number | null
          status: string
          symbol: string
          type: string
          user_id: string
        }
        Insert: {
          broker?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mode?: string
          order_id?: string | null
          pnl?: number | null
          price?: number | null
          quantity: number
          side: string
          slippage_pct?: number | null
          status: string
          symbol: string
          type: string
          user_id: string
        }
        Update: {
          broker?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          mode?: string
          order_id?: string | null
          pnl?: number | null
          price?: number | null
          quantity?: number
          side?: string
          slippage_pct?: number | null
          status?: string
          symbol?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      external_accounts: {
        Row: {
          address: string | null
          created_at: string
          currency: string | null
          external_id: string | null
          id: string
          is_active: boolean
          label: string | null
          metadata: Json | null
          network: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          currency?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          metadata?: Json | null
          network?: string | null
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          currency?: string | null
          external_id?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          metadata?: Json | null
          network?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interest_leads: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          interested_plan: string | null
          notes: string | null
          phone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          interested_plan?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          interested_plan?: string | null
          notes?: string | null
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
      investment_plans: {
        Row: {
          ai_confidence: number | null
          allocation: Json
          capital_amount: number
          created_at: string
          currency: string
          duration_days: number
          id: string
          name: string
          plan_type: string
          projection: Json
          risk_level: string
          status: string
          target_markets: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          allocation?: Json
          capital_amount: number
          created_at?: string
          currency?: string
          duration_days: number
          id?: string
          name: string
          plan_type: string
          projection?: Json
          risk_level?: string
          status?: string
          target_markets?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          allocation?: Json
          capital_amount?: number
          created_at?: string
          currency?: string
          duration_days?: number
          id?: string
          name?: string
          plan_type?: string
          projection?: Json
          risk_level?: string
          status?: string
          target_markets?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_archive: {
        Row: {
          asset_name: string
          captured_at: string
          change_pct: number | null
          high: number | null
          id: string
          low: number | null
          price: number
          symbol: string
          user_id: string
          volume: number | null
        }
        Insert: {
          asset_name: string
          captured_at?: string
          change_pct?: number | null
          high?: number | null
          id?: string
          low?: number | null
          price: number
          symbol: string
          user_id: string
          volume?: number | null
        }
        Update: {
          asset_name?: string
          captured_at?: string
          change_pct?: number | null
          high?: number | null
          id?: string
          low?: number | null
          price?: number
          symbol?: string
          user_id?: string
          volume?: number | null
        }
        Relationships: []
      }
      paper_balances: {
        Row: {
          cash_usd: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_usd?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_usd?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paper_trades: {
        Row: {
          asset_name: string
          closed_at: string | null
          closed_price: number | null
          id: string
          opened_at: string
          pnl: number | null
          price: number
          quantity: number
          side: string
          status: string
          symbol: string
          user_id: string
        }
        Insert: {
          asset_name: string
          closed_at?: string | null
          closed_price?: number | null
          id?: string
          opened_at?: string
          pnl?: number | null
          price: number
          quantity: number
          side: string
          status?: string
          symbol: string
          user_id: string
        }
        Update: {
          asset_name?: string
          closed_at?: string | null
          closed_price?: number | null
          id?: string
          opened_at?: string
          pnl?: number | null
          price?: number
          quantity?: number
          side?: string
          status?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          asset_name: string | null
          avg_price: number
          created_at: string
          currency: string
          id: string
          market: string | null
          portfolio_id: string
          quantity: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_name?: string | null
          avg_price?: number
          created_at?: string
          currency?: string
          id?: string
          market?: string | null
          portfolio_id: string
          quantity?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_name?: string | null
          avg_price?: number
          created_at?: string
          currency?: string
          id?: string
          market?: string | null
          portfolio_id?: string
          quantity?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_holdings_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          available: number
          captured_at: string
          equity: number
          exposure_pct: number | null
          holdings: Json
          id: string
          pnl_day: number | null
          pnl_total: number | null
          user_id: string
        }
        Insert: {
          available: number
          captured_at?: string
          equity: number
          exposure_pct?: number | null
          holdings?: Json
          id?: string
          pnl_day?: number | null
          pnl_total?: number | null
          user_id: string
        }
        Update: {
          available?: number
          captured_at?: string
          equity?: number
          exposure_pct?: number | null
          holdings?: Json
          id?: string
          pnl_day?: number | null
          pnl_total?: number | null
          user_id?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          name: string
          strategy: string | null
          user_id: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          id?: string
          name: string
          strategy?: string | null
          user_id: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          name?: string
          strategy?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          language: string
          preferred_currency: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          language?: string
          preferred_currency?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          language?: string
          preferred_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      resend_email_log: {
        Row: {
          attempts: number
          category: string
          created_at: string
          error_message: string | null
          id: string
          lang: string
          provider_message_id: string | null
          provider_response: Json | null
          recipient: string
          status: string
          subject: string
          template: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          category: string
          created_at?: string
          error_message?: string | null
          id?: string
          lang?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient: string
          status?: string
          subject: string
          template: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          category?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lang?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          recipient?: string
          status?: string
          subject?: string
          template?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      risk_events: {
        Row: {
          category: string
          context: Json | null
          created_at: string
          id: string
          message: string
          resolved_at: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          category: string
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          resolved_at?: string | null
          severity: string
          user_id?: string | null
        }
        Update: {
          category?: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          resolved_at?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          code: string
          created_at: string
          duration_months: number
          features: Json
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          price_sar: number
          sort_order: number
          trial_days: number
        }
        Insert: {
          code: string
          created_at?: string
          duration_months: number
          features?: Json
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          price_sar: number
          sort_order?: number
          trial_days?: number
        }
        Update: {
          code?: string
          created_at?: string
          duration_months?: number
          features?: Json
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          price_sar?: number
          sort_order?: number
          trial_days?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_paid: number | null
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          moyasar_payment_id: string | null
          plan_id: string
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          moyasar_payment_id?: string | null
          plan_id: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          moyasar_payment_id?: string | null
          plan_id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_events: {
        Row: {
          context: Json
          created_at: string
          event_type: string
          fingerprint: string | null
          id: string
          message: string | null
          request_id: string | null
          severity: string
          source: string
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          event_type: string
          fingerprint?: string | null
          id?: string
          message?: string | null
          request_id?: string | null
          severity: string
          source: string
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          event_type?: string
          fingerprint?: string | null
          id?: string
          message?: string | null
          request_id?: string | null
          severity?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trade_signals: {
        Row: {
          action: string
          asset_name: string
          category: string | null
          confidence: number
          entry_price: number | null
          expires_at: string
          generated_at: string
          horizon: string
          id: string
          indicators: Json | null
          rationale: string | null
          sentiment_score: number | null
          stop_loss: number | null
          symbol: string
          targets: Json | null
          technical_score: number | null
        }
        Insert: {
          action: string
          asset_name: string
          category?: string | null
          confidence?: number
          entry_price?: number | null
          expires_at?: string
          generated_at?: string
          horizon?: string
          id?: string
          indicators?: Json | null
          rationale?: string | null
          sentiment_score?: number | null
          stop_loss?: number | null
          symbol: string
          targets?: Json | null
          technical_score?: number | null
        }
        Update: {
          action?: string
          asset_name?: string
          category?: string | null
          confidence?: number
          entry_price?: number | null
          expires_at?: string
          generated_at?: string
          horizon?: string
          id?: string
          indicators?: Json | null
          rationale?: string | null
          sentiment_score?: number | null
          stop_loss?: number | null
          symbol?: string
          targets?: Json | null
          technical_score?: number | null
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          auth_tag: string
          created_at: string
          encrypted_api_key: string
          id: string
          iv: string
          key_hint: string
          provider: string
          user_id: string
        }
        Insert: {
          auth_tag: string
          created_at?: string
          encrypted_api_key: string
          id?: string
          iv: string
          key_hint: string
          provider: string
          user_id: string
        }
        Update: {
          auth_tag?: string
          created_at?: string
          encrypted_api_key?: string
          id?: string
          iv?: string
          key_hint?: string
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          amount_sar: number
          created_at: string
          id: string
          metadata: Json | null
          moyasar_fee_sar: number
          moyasar_payment_id: string | null
          net_credit_sar: number
          payment_method: string | null
          service_fee_sar: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_sar: number
          created_at?: string
          id?: string
          metadata?: Json | null
          moyasar_fee_sar?: number
          moyasar_payment_id?: string | null
          net_credit_sar: number
          payment_method?: string | null
          service_fee_sar?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_sar?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          moyasar_fee_sar?: number
          moyasar_payment_id?: string | null
          net_credit_sar?: number
          payment_method?: string | null
          service_fee_sar?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          reference: string | null
          status: string
          type: string
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          reference?: string | null
          status?: string
          type: string
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          reference?: string | null
          status?: string
          type?: string
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          asset_name: string
          category: string | null
          created_at: string
          id: string
          notes: string | null
          symbol: string
          user_id: string
        }
        Insert: {
          asset_name: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          symbol: string
          user_id: string
        }
        Update: {
          asset_name?: string
          category?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      broker_credentials_meta: {
        Row: {
          broker: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          label: string | null
          mode: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          broker?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          label?: string | null
          mode?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          broker?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          label?: string | null
          mode?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      db_health_check: { Args: never; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_accepted_disclaimer: { Args: { _version: string }; Returns: boolean }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      system_health_snapshot: { Args: never; Returns: Json }
      wallet_apply_order: {
        Args: { _amount: number; _side: string; _user_id: string }
        Returns: {
          balance: number
          currency: string
          id: string
        }[]
      }
      wallet_credit_topup: {
        Args: {
          _payment_id: string
          _payment_method: string
          _topup_id: string
        }
        Returns: {
          amount: number
          credited: boolean
          user_id: string
          wallet_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "subscriber" | "pending"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "subscriber", "pending"],
    },
  },
} as const
