export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      account_info: {
        Row: {
          account_bank: string;
          account_number: string;
          account_user_name: string;
          created_at: string;
          display_number: string;
          id: number;
          user_id: string | null;
        };
        Insert: {
          account_bank: string;
          account_number?: string;
          account_user_name: string;
          created_at?: string;
          display_number: string;
          id?: number;
          user_id?: string | null;
        };
        Update: {
          account_bank?: string;
          account_number?: string;
          account_user_name?: string;
          created_at?: string;
          display_number?: string;
          id?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'account_info_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      ad_lottery_slots: {
        Row: {
          created_at: string;
          id: string;
          reward_metadata: Json | null;
          reward_type: string;
          slot_time: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reward_metadata?: Json | null;
          reward_type: string;
          slot_time: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reward_metadata?: Json | null;
          reward_type?: string;
          slot_time?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ad_lottery_slots_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      advertisers: {
        Row: {
          company_name: string;
          created_at: string;
          id: number;
          login_id: string;
          password_hash: string;
          updated_at: string;
        };
        Insert: {
          company_name: string;
          created_at?: string;
          id?: never;
          login_id: string;
          password_hash: string;
          updated_at?: string;
        };
        Update: {
          company_name?: string;
          created_at?: string;
          id?: never;
          login_id?: string;
          password_hash?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      affiliate_callback_data: {
        Row: {
          approval_date: string;
          completed_at: string | null;
          created_at: string;
          data: Json | null;
          id: number;
          instant_amount: number;
          point_amount: number;
          prepayment_metadata: Json | null;
          status: string;
          transaction_id: number;
          user_id: string;
        };
        Insert: {
          approval_date: string;
          completed_at?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: number;
          instant_amount?: number;
          point_amount: number;
          prepayment_metadata?: Json | null;
          status?: string;
          transaction_id: number;
          user_id: string;
        };
        Update: {
          approval_date?: string;
          completed_at?: string | null;
          created_at?: string;
          data?: Json | null;
          id?: number;
          instant_amount?: number;
          point_amount?: number;
          prepayment_metadata?: Json | null;
          status?: string;
          transaction_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'apiliate_callback_data_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      attendance: {
        Row: {
          created_at: string;
          created_at_date: string;
          id: number;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_at_date: string;
          id?: number;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_at_date?: string;
          id?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'attendance_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      available_claim: {
        Row: {
          created_at: string;
          discount_percent: number;
          id: number;
          location_id: number;
          reason: Json | null;
          search_position: unknown;
          status: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          discount_percent: number;
          id?: number;
          location_id: number;
          reason?: Json | null;
          search_position?: unknown;
          status?: string;
          type?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          discount_percent?: number;
          id?: number;
          location_id?: number;
          reason?: Json | null;
          search_position?: unknown;
          status?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'available_claim_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'available_claim_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      banned_user: {
        Row: {
          auth_id: string;
          created_at: string;
          id: number;
          reason: string;
          user_id: string | null;
        };
        Insert: {
          auth_id: string;
          created_at?: string;
          id?: number;
          reason?: string;
          user_id?: string | null;
        };
        Update: {
          auth_id?: string;
          created_at?: string;
          id?: number;
          reason?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      banner_ad_daily_stats: {
        Row: {
          ad_id: number;
          clicks: number;
          id: number;
          impressions: number;
          stat_date: string;
          updated_at: string;
        };
        Insert: {
          ad_id: number;
          clicks?: number;
          id?: never;
          impressions?: number;
          stat_date?: string;
          updated_at?: string;
        };
        Update: {
          ad_id?: number;
          clicks?: number;
          id?: never;
          impressions?: number;
          stat_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'banner_ad_daily_stats_ad_id_fkey';
            columns: ['ad_id'];
            isOneToOne: false;
            referencedRelation: 'banner_ads';
            referencedColumns: ['id'];
          },
        ];
      };
      banner_ad_events: {
        Row: {
          ad_id: number;
          created_at: string;
          event_type: string;
          id: number;
          user_id: string;
        };
        Insert: {
          ad_id: number;
          created_at?: string;
          event_type: string;
          id?: never;
          user_id: string;
        };
        Update: {
          ad_id?: number;
          created_at?: string;
          event_type?: string;
          id?: never;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'banner_ad_events_ad_id_fkey';
            columns: ['ad_id'];
            isOneToOne: false;
            referencedRelation: 'banner_ads';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'banner_ad_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      banner_ads: {
        Row: {
          advertiser_id: number | null;
          click_url: string;
          created_at: string;
          end_date: string | null;
          id: number;
          image_url: string;
          is_active: boolean;
          placement: string;
          priority: number;
          start_date: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          advertiser_id?: number | null;
          click_url: string;
          created_at?: string;
          end_date?: string | null;
          id?: never;
          image_url: string;
          is_active?: boolean;
          placement?: string;
          priority?: number;
          start_date?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          advertiser_id?: number | null;
          click_url?: string;
          created_at?: string;
          end_date?: string | null;
          id?: never;
          image_url?: string;
          is_active?: boolean;
          placement?: string;
          priority?: number;
          start_date?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'banner_ads_advertiser_id_fkey';
            columns: ['advertiser_id'];
            isOneToOne: false;
            referencedRelation: 'advertisers';
            referencedColumns: ['id'];
          },
        ];
      };
      bigquery_sync_status: {
        Row: {
          destination: string;
          id: number;
          last_sync_time: string;
          table_name: string;
          updated_at: string;
        };
        Insert: {
          destination: string;
          id?: number;
          last_sync_time: string;
          table_name: string;
          updated_at?: string;
        };
        Update: {
          destination?: string;
          id?: number;
          last_sync_time?: string;
          table_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bundles: {
        Row: {
          channel: string;
          enabled: boolean;
          file_hash: string;
          fingerprint_hash: string | null;
          git_commit_hash: string | null;
          id: string;
          message: string | null;
          metadata: Json | null;
          platform: Database['public']['Enums']['platforms'];
          should_force_update: boolean;
          storage_uri: string;
          target_app_version: string | null;
        };
        Insert: {
          channel?: string;
          enabled: boolean;
          file_hash: string;
          fingerprint_hash?: string | null;
          git_commit_hash?: string | null;
          id: string;
          message?: string | null;
          metadata?: Json | null;
          platform: Database['public']['Enums']['platforms'];
          should_force_update: boolean;
          storage_uri: string;
          target_app_version?: string | null;
        };
        Update: {
          channel?: string;
          enabled?: boolean;
          file_hash?: string;
          fingerprint_hash?: string | null;
          git_commit_hash?: string | null;
          id?: string;
          message?: string | null;
          metadata?: Json | null;
          platform?: Database['public']['Enums']['platforms'];
          should_force_update?: boolean;
          storage_uri?: string;
          target_app_version?: string | null;
        };
        Relationships: [];
      };
      cash_exchanges: {
        Row: {
          amount: number;
          cancelled_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          id: number;
          point_action_id: number | null;
          reason: string | null;
          rejected_at: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          id?: number;
          point_action_id?: number | null;
          reason?: string | null;
          rejected_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          id?: number;
          point_action_id?: number | null;
          reason?: string | null;
          rejected_at?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_exchanges_point_action_id_fkey';
            columns: ['point_action_id'];
            isOneToOne: false;
            referencedRelation: 'point_actions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_exchanges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      cashback_rate: {
        Row: {
          created_at: string;
          day_of_week: number | null;
          end_hour: number | null;
          id: number;
          location_id: number;
          max_rate: number;
          min_rate: number;
          priority: number;
          start_hour: number | null;
          time_policy_type: string | null;
          type: string;
        };
        Insert: {
          created_at?: string;
          day_of_week?: number | null;
          end_hour?: number | null;
          id?: number;
          location_id: number;
          max_rate: number;
          min_rate: number;
          priority?: number;
          start_hour?: number | null;
          time_policy_type?: string | null;
          type?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number | null;
          end_hour?: number | null;
          id?: number;
          location_id?: number;
          max_rate?: number;
          min_rate?: number;
          priority?: number;
          start_hour?: number | null;
          time_policy_type?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cashback_percent_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
        ];
      };
      claim: {
        Row: {
          analysis_result: Json;
          available_claim_id: number | null;
          brand_card_id: number | null;
          cashback_amount: number | null;
          confirmed_at: string | null;
          confirmed_cash: number | null;
          created_at: string;
          discount_percent: number;
          drop_card_id: string | null;
          id: number;
          location_id: number | null;
          reason: string | null;
          receipt_image_url: string;
          rejected_at: string | null;
          rejected_reason: string;
          status: Database['public']['Enums']['claim_status'];
          user_id: string | null;
        };
        Insert: {
          analysis_result?: Json;
          available_claim_id?: number | null;
          brand_card_id?: number | null;
          cashback_amount?: number | null;
          confirmed_at?: string | null;
          confirmed_cash?: number | null;
          created_at?: string;
          discount_percent: number;
          drop_card_id?: string | null;
          id?: number;
          location_id?: number | null;
          reason?: string | null;
          receipt_image_url?: string;
          rejected_at?: string | null;
          rejected_reason?: string;
          status?: Database['public']['Enums']['claim_status'];
          user_id?: string | null;
        };
        Update: {
          analysis_result?: Json;
          available_claim_id?: number | null;
          brand_card_id?: number | null;
          cashback_amount?: number | null;
          confirmed_at?: string | null;
          confirmed_cash?: number | null;
          created_at?: string;
          discount_percent?: number;
          drop_card_id?: string | null;
          id?: number;
          location_id?: number | null;
          reason?: string | null;
          receipt_image_url?: string;
          rejected_at?: string | null;
          rejected_reason?: string;
          status?: Database['public']['Enums']['claim_status'];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'claim_available_claim_id_fkey';
            columns: ['available_claim_id'];
            isOneToOne: false;
            referencedRelation: 'available_claim';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'claim_brand_card_id_fkey';
            columns: ['brand_card_id'];
            isOneToOne: false;
            referencedRelation: 'drop_brand_card';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'claim_drop_card_id_fkey';
            columns: ['drop_card_id'];
            isOneToOne: false;
            referencedRelation: 'drop_card_user';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'claim_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'claim_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      claim_log: {
        Row: {
          claim_id: number;
          created_at: string;
          id: number;
          log: string | null;
          user_id: string | null;
        };
        Insert: {
          claim_id: number;
          created_at?: string;
          id?: number;
          log?: string | null;
          user_id?: string | null;
        };
        Update: {
          claim_id?: number;
          created_at?: string;
          id?: number;
          log?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'claim_log_claim_id_fkey';
            columns: ['claim_id'];
            isOneToOne: false;
            referencedRelation: 'claim';
            referencedColumns: ['id'];
          },
        ];
      };
      cluster_results: {
        Row: {
          clustering_settings: Json | null;
          clusters: Json | null;
          created_at: string | null;
          id: string;
          num_clusters: number | null;
          preprocessing_settings: Json | null;
          total_points: number | null;
          user_id: string | null;
        };
        Insert: {
          clustering_settings?: Json | null;
          clusters?: Json | null;
          created_at?: string | null;
          id?: string;
          num_clusters?: number | null;
          preprocessing_settings?: Json | null;
          total_points?: number | null;
          user_id?: string | null;
        };
        Update: {
          clustering_settings?: Json | null;
          clusters?: Json | null;
          created_at?: string | null;
          id?: string;
          num_clusters?: number | null;
          preprocessing_settings?: Json | null;
          total_points?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cluster_results_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      coupang_postbacks: {
        Row: {
          adid: string;
          afcode: string;
          click_id: string;
          created_at: string;
          id: number;
          order_price: number;
          order_time: string;
          os: string;
          purchase_cancel: string;
          raw_body: Json | null;
          subid: string;
        };
        Insert: {
          adid: string;
          afcode: string;
          click_id?: string;
          created_at?: string;
          id?: never;
          order_price: number;
          order_time: string;
          os: string;
          purchase_cancel: string;
          raw_body?: Json | null;
          subid: string;
        };
        Update: {
          adid?: string;
          afcode?: string;
          click_id?: string;
          created_at?: string;
          id?: never;
          order_price?: number;
          order_time?: string;
          os?: string;
          purchase_cancel?: string;
          raw_body?: Json | null;
          subid?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          cashback_percent: number;
          created_at: string;
          description: string;
          expires_at: string | null;
          id: string;
          status: string;
          type: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          cashback_percent: number;
          created_at?: string;
          description?: string;
          expires_at?: string | null;
          id?: string;
          status: string;
          type: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          cashback_percent?: number;
          created_at?: string;
          description?: string;
          expires_at?: string | null;
          id?: string;
          status?: string;
          type?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coupons_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      device_event_participation: {
        Row: {
          created_at: string;
          device_id: string;
          event_name: string;
          id: number;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          event_name: string;
          id?: number;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          event_name?: string;
          id?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'device_event_participation_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      dividend_simulations: {
        Row: {
          created_at: string | null;
          id: string;
          month: number;
          status: string;
          tiers: Json;
          total_budget: number;
          total_receipts: number;
          total_users: number;
          updated_at: string | null;
          year: number;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          month: number;
          status?: string;
          tiers: Json;
          total_budget: number;
          total_receipts: number;
          total_users: number;
          updated_at?: string | null;
          year: number;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          month?: number;
          status?: string;
          tiers?: Json;
          total_budget?: number;
          total_receipts?: number;
          total_users?: number;
          updated_at?: string | null;
          year?: number;
        };
        Relationships: [];
      };
      drop_brand: {
        Row: {
          card_background_image_url: string | null;
          card_selected_image_url: string | null;
          created_at: string;
          id: number;
          logo_image_url: string | null;
          name: string;
        };
        Insert: {
          card_background_image_url?: string | null;
          card_selected_image_url?: string | null;
          created_at?: string;
          id?: number;
          logo_image_url?: string | null;
          name: string;
        };
        Update: {
          card_background_image_url?: string | null;
          card_selected_image_url?: string | null;
          created_at?: string;
          id?: number;
          logo_image_url?: string | null;
          name?: string;
        };
        Relationships: [];
      };
      drop_brand_card: {
        Row: {
          brand_id: number;
          created_at: string;
          id: number;
          user_id: string;
        };
        Insert: {
          brand_id: number;
          created_at?: string;
          id?: number;
          user_id: string;
        };
        Update: {
          brand_id?: number;
          created_at?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'drop_brand_card_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'drop_brand';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'drop_brand_card_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      drop_card_pack: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          is_default: boolean;
          name: string;
          valid_hours: number;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          is_default?: boolean;
          name: string;
          valid_hours?: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          is_default?: boolean;
          name?: string;
          valid_hours?: number;
        };
        Relationships: [];
      };
      drop_card_pack_relation: {
        Row: {
          card_id: string;
          created_at: string;
          id: string;
          pack_id: string;
          priority: number;
        };
        Insert: {
          card_id?: string;
          created_at?: string;
          id?: string;
          pack_id?: string;
          priority?: number;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          id?: string;
          pack_id?: string;
          priority?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'drop_card_pack_relation_card_id_fkey';
            columns: ['card_id'];
            isOneToOne: false;
            referencedRelation: 'drop_card_template';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'drop_card_pack_relation_pack_id_fkey';
            columns: ['pack_id'];
            isOneToOne: false;
            referencedRelation: 'drop_card_pack';
            referencedColumns: ['id'];
          },
        ];
      };
      drop_card_template: {
        Row: {
          background_image: string;
          brand_id: number | null;
          brand_name: string;
          cashback_rate: number;
          created_at: string;
          hidden_card_hint: string | null;
          id: string;
          is_default_visible: boolean;
          logo_image: string;
          max_cashback_amount: number | null;
          name: string;
          policies: string[];
          type: string;
        };
        Insert: {
          background_image?: string;
          brand_id?: number | null;
          brand_name?: string;
          cashback_rate: number;
          created_at?: string;
          hidden_card_hint?: string | null;
          id?: string;
          is_default_visible?: boolean;
          logo_image?: string;
          max_cashback_amount?: number | null;
          name: string;
          policies: string[];
          type?: string;
        };
        Update: {
          background_image?: string;
          brand_id?: number | null;
          brand_name?: string;
          cashback_rate?: number;
          created_at?: string;
          hidden_card_hint?: string | null;
          id?: string;
          is_default_visible?: boolean;
          logo_image?: string;
          max_cashback_amount?: number | null;
          name?: string;
          policies?: string[];
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'drop_card_template_brand_id_fkey';
            columns: ['brand_id'];
            isOneToOne: false;
            referencedRelation: 'drop_brand';
            referencedColumns: ['id'];
          },
        ];
      };
      drop_card_user: {
        Row: {
          assigned_pack_id: string | null;
          created_at: string;
          id: string;
          status: string;
          template_id: string | null;
          user_id: string | null;
        };
        Insert: {
          assigned_pack_id?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          template_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          assigned_pack_id?: string | null;
          created_at?: string;
          id?: string;
          status?: string;
          template_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'drop_card_user_assigned_pack_id_fkey';
            columns: ['assigned_pack_id'];
            isOneToOne: false;
            referencedRelation: 'drop_user_assigned_pack';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'drop_card_user_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'drop_card_template';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_drop_card_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      drop_service_participants: {
        Row: {
          created_at: string;
          from_invitation: boolean;
          id: number;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          from_invitation?: boolean;
          id?: number;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          from_invitation?: boolean;
          id?: number;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'drop_service_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      drop_user_assigned_pack: {
        Row: {
          created_at: string;
          end_time: string;
          id: string;
          is_opened: boolean;
          pack_id: string;
          start_time: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          end_time?: string;
          id?: string;
          is_opened?: boolean;
          pack_id?: string;
          start_time?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          id?: string;
          is_opened?: boolean;
          pack_id?: string;
          start_time?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'drop_user_assigned_pack_pack_id_fkey';
            columns: ['pack_id'];
            isOneToOne: false;
            referencedRelation: 'drop_card_pack';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'drop_user_assigned_pack_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      every_receipt: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: number;
          image_url: string;
          point: number;
          position: unknown;
          raw_data: string;
          reason: string;
          receipt_data: Json | null;
          rejected_reason: string | null;
          score_data: Json | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          verification: Json | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: number;
          image_url?: string;
          point?: number;
          position?: unknown;
          raw_data?: string;
          reason?: string;
          receipt_data?: Json | null;
          rejected_reason?: string | null;
          score_data?: Json | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          verification?: Json | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: number;
          image_url?: string;
          point?: number;
          position?: unknown;
          raw_data?: string;
          reason?: string;
          receipt_data?: Json | null;
          rejected_reason?: string | null;
          score_data?: Json | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          verification?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'every_receipt_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      every_receipt_analysis: {
        Row: {
          created_at: string;
          every_receipt_id: number;
          extra_data: Json | null;
          file_hash: string | null;
          id: number;
          payment_date: string | null;
          raw_text: string | null;
          store_name: string | null;
          total_amount: number | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          every_receipt_id: number;
          extra_data?: Json | null;
          file_hash?: string | null;
          id?: number;
          payment_date?: string | null;
          raw_text?: string | null;
          store_name?: string | null;
          total_amount?: number | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          every_receipt_id?: number;
          extra_data?: Json | null;
          file_hash?: string | null;
          id?: number;
          payment_date?: string | null;
          raw_text?: string | null;
          store_name?: string | null;
          total_amount?: number | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'every_receipt_analysis_every_receipt_id_fkey';
            columns: ['every_receipt_id'];
            isOneToOne: true;
            referencedRelation: 'every_receipt';
            referencedColumns: ['id'];
          },
        ];
      };
      every_receipt_location: {
        Row: {
          created_at: string;
          every_receipt_id: number;
          id: number;
          receipt_created_at: string | null;
          sigungu_code: string | null;
          sigungu_name: string | null;
        };
        Insert: {
          created_at?: string;
          every_receipt_id: number;
          id?: number;
          receipt_created_at?: string | null;
          sigungu_code?: string | null;
          sigungu_name?: string | null;
        };
        Update: {
          created_at?: string;
          every_receipt_id?: number;
          id?: number;
          receipt_created_at?: string | null;
          sigungu_code?: string | null;
          sigungu_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'every_receipt_location_every_receipt_id_fkey';
            columns: ['every_receipt_id'];
            isOneToOne: true;
            referencedRelation: 'every_receipt';
            referencedColumns: ['id'];
          },
        ];
      };
      every_receipt_re_review: {
        Row: {
          after_score_data: Json | null;
          before_score_data: Json | null;
          created_at: string;
          every_receipt_id: number;
          id: number;
          requested_items: string[] | null;
          reviewed_at: string | null;
          status: string;
          user_id: string | null;
          user_note: string;
        };
        Insert: {
          after_score_data?: Json | null;
          before_score_data?: Json | null;
          created_at?: string;
          every_receipt_id: number;
          id?: number;
          requested_items?: string[] | null;
          reviewed_at?: string | null;
          status?: string;
          user_id?: string | null;
          user_note?: string;
        };
        Update: {
          after_score_data?: Json | null;
          before_score_data?: Json | null;
          created_at?: string;
          every_receipt_id?: number;
          id?: number;
          requested_items?: string[] | null;
          reviewed_at?: string | null;
          status?: string;
          user_id?: string | null;
          user_note?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'every_receipt_re_review_every_receipt_id_fkey';
            columns: ['every_receipt_id'];
            isOneToOne: false;
            referencedRelation: 'every_receipt';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'every_receipt_re_review_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      feature_flag: {
        Row: {
          created_at: string;
          description: string;
          enabled: boolean;
          id: number;
          name: string;
          role: string[];
        };
        Insert: {
          created_at?: string;
          description?: string;
          enabled: boolean;
          id?: number;
          name: string;
          role?: string[];
        };
        Update: {
          created_at?: string;
          description?: string;
          enabled?: boolean;
          id?: number;
          name?: string;
          role?: string[];
        };
        Relationships: [];
      };
      global_retailer_info: {
        Row: {
          created_at: string;
          data: Json | null;
          id: number;
          lang: string;
          location_id: number;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id?: number;
          lang: string;
          location_id: number;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: number;
          lang?: string;
          location_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'global_retailer_info_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
        ];
      };
      invitation: {
        Row: {
          created_at: string;
          id: number;
          identifier: string;
          receiver_id: string | null;
          sender_id: string;
          status: string;
          type: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          identifier?: string;
          receiver_id?: string | null;
          sender_id: string;
          status: string;
          type?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          identifier?: string;
          receiver_id?: string | null;
          sender_id?: string;
          status?: string;
          type?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitation_receiver_id_fkey';
            columns: ['receiver_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitation_sender_id_fkey';
            columns: ['sender_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      invitation_event: {
        Row: {
          created_at: string;
          event_id: number;
          id: number;
          invited_user_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_id: number;
          id?: number;
          invited_user_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_id?: number;
          id?: number;
          invited_user_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'invitation_event_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'device_event_participation';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitation_event_invited_user_id_fkey';
            columns: ['invited_user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitation_event_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      invitation_reward_info: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          phone_number: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          phone_number: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          phone_number?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitation_reward_info_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      invitation_rewards: {
        Row: {
          completed_at: string | null;
          created_at: string;
          expired_at: string | null;
          id: number;
          requested_at: string | null;
          status: string | null;
          title: string | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          expired_at?: string | null;
          id?: number;
          requested_at?: string | null;
          status?: string | null;
          title?: string | null;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          expired_at?: string | null;
          id?: number;
          requested_at?: string | null;
          status?: string | null;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitation_rewards_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      invitation_user: {
        Row: {
          created_at: string;
          id: number;
          invitation_id: number | null;
          source_receipt_id: number | null;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          invitation_id?: number | null;
          source_receipt_id?: number | null;
          type?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          invitation_id?: number | null;
          source_receipt_id?: number | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invitation_user_invitation_id_fkey';
            columns: ['invitation_id'];
            isOneToOne: false;
            referencedRelation: 'invitation';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'invitation_user_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      landing_info: {
        Row: {
          created_at: string;
          id: number;
          position: unknown;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          position: unknown;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          position?: unknown;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'landing_info_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      location_blogs: {
        Row: {
          created_at: string;
          description: string | null;
          id: number;
          image: string | null;
          link: string | null;
          location_id: number | null;
          posted_at: string;
          title: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: number;
          image?: string | null;
          link?: string | null;
          location_id?: number | null;
          posted_at: string;
          title?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: number;
          image?: string | null;
          link?: string | null;
          location_id?: number | null;
          posted_at?: string;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'location_blogs_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
        ];
      };
      location_info: {
        Row: {
          address: string;
          category: string;
          created_at: string;
          custom_cashback_text: string;
          description: string;
          google_place_id: string | null;
          id: number;
          instagram_url: string;
          is_partner: boolean;
          is_visible: boolean;
          keywords: string[];
          location: unknown;
          logo_url: string;
          max_cashback_amount: number | null;
          max_discount: number | null;
          min_discount: number | null;
          naver_place_id: string;
          naver_place_url: string;
          title: string;
          working_hours: Json | null;
        };
        Insert: {
          address: string;
          category?: string;
          created_at?: string;
          custom_cashback_text?: string;
          description?: string;
          google_place_id?: string | null;
          id?: number;
          instagram_url?: string;
          is_partner?: boolean;
          is_visible?: boolean;
          keywords?: string[];
          location?: unknown;
          logo_url?: string;
          max_cashback_amount?: number | null;
          max_discount?: number | null;
          min_discount?: number | null;
          naver_place_id?: string;
          naver_place_url?: string;
          title: string;
          working_hours?: Json | null;
        };
        Update: {
          address?: string;
          category?: string;
          created_at?: string;
          custom_cashback_text?: string;
          description?: string;
          google_place_id?: string | null;
          id?: number;
          instagram_url?: string;
          is_partner?: boolean;
          is_visible?: boolean;
          keywords?: string[];
          location?: unknown;
          logo_url?: string;
          max_cashback_amount?: number | null;
          max_discount?: number | null;
          min_discount?: number | null;
          naver_place_id?: string;
          naver_place_url?: string;
          title?: string;
          working_hours?: Json | null;
        };
        Relationships: [];
      };
      location_info_images: {
        Row: {
          created_at: string;
          id: number;
          image_url: string;
          location_id: number;
          priority: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          image_url?: string;
          location_id: number;
          priority?: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          image_url?: string;
          location_id?: number;
          priority?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'location_info_images_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
        ];
      };
      location_menu: {
        Row: {
          created_at: string;
          description: string;
          id: number;
          image_url: string;
          location_id: number | null;
          name: string;
          price: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: number;
          image_url?: string;
          location_id?: number | null;
          name?: string;
          price?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: number;
          image_url?: string;
          location_id?: number | null;
          name?: string;
          price?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_menu_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
        ];
      };
      location_naver_image: {
        Row: {
          created_at: string;
          id: number;
          location_id: number;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          location_id: number;
          url?: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          location_id?: number;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_naver_image_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
        ];
      };
      location_reviews: {
        Row: {
          created_at: string;
          id: number;
          location_id: number;
          review: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          location_id: number;
          review?: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          location_id?: number;
          review?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'location_reviews_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
        ];
      };
      location_tag: {
        Row: {
          color: string;
          created_at: string;
          id: number;
          title: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: number;
          title: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: number;
          title?: string;
        };
        Relationships: [];
      };
      location_tag_relation: {
        Row: {
          created_at: string;
          id: number;
          location_info_id: number;
          tag_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          location_info_id: number;
          tag_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          location_info_id?: number;
          tag_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'location_tag_relation_location_info_id_fkey';
            columns: ['location_info_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'location_tag_relation_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'location_tag';
            referencedColumns: ['id'];
          },
        ];
      };
      lotteries: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          issued_at: string;
          lottery_type_id: string;
          reason: string | null;
          reward_amount: number | null;
          status: string;
          updated_at: string;
          used_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          issued_at?: string;
          lottery_type_id: string;
          reason?: string | null;
          reward_amount?: number | null;
          status?: string;
          updated_at?: string;
          used_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          issued_at?: string;
          lottery_type_id?: string;
          reason?: string | null;
          reward_amount?: number | null;
          status?: string;
          updated_at?: string;
          used_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'lotteries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      modal_shown: {
        Row: {
          additional_data: Json | null;
          created_at: string;
          id: number;
          name: string;
          status: string;
          user_id: string | null;
        };
        Insert: {
          additional_data?: Json | null;
          created_at?: string;
          id?: number;
          name: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          additional_data?: Json | null;
          created_at?: string;
          id?: number;
          name?: string;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'modal_seen_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      monthly_earned_points: {
        Row: {
          created_at: string;
          earned_points: number;
          id: number;
          updated_at: string;
          user_id: string;
          year_month: string;
        };
        Insert: {
          created_at?: string;
          earned_points?: number;
          id?: number;
          updated_at?: string;
          user_id: string;
          year_month: string;
        };
        Update: {
          created_at?: string;
          earned_points?: number;
          id?: number;
          updated_at?: string;
          user_id?: string;
          year_month?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'monthly_earned_points_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      naver_pay_accounts: {
        Row: {
          connected_at: string | null;
          created_at: string;
          dau_masking_id: string | null;
          dau_user_key: string | null;
          disconnected_at: string | null;
          error_code: string | null;
          id: string;
          naver_unique_id: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          connected_at?: string | null;
          created_at?: string;
          dau_masking_id?: string | null;
          dau_user_key?: string | null;
          disconnected_at?: string | null;
          error_code?: string | null;
          id?: string;
          naver_unique_id?: string | null;
          status: string;
          user_id: string;
        };
        Update: {
          connected_at?: string | null;
          created_at?: string;
          dau_masking_id?: string | null;
          dau_user_key?: string | null;
          disconnected_at?: string | null;
          error_code?: string | null;
          id?: string;
          naver_unique_id?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'naver_pay_accounts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      naver_pay_exchanges: {
        Row: {
          cashmore_point: number;
          created_at: string;
          error_code: string | null;
          exchange_rate: number;
          id: string;
          naver_pay_account_id: string | null;
          naverpay_point: number;
          partner_tx_no: string | null;
          point_action_id: number | null;
          processed_at: string | null;
          status: string;
          tx_no: string | null;
          user_id: string | null;
        };
        Insert: {
          cashmore_point: number;
          created_at?: string;
          error_code?: string | null;
          exchange_rate: number;
          id?: string;
          naver_pay_account_id?: string | null;
          naverpay_point: number;
          partner_tx_no?: string | null;
          point_action_id?: number | null;
          processed_at?: string | null;
          status: string;
          tx_no?: string | null;
          user_id?: string | null;
        };
        Update: {
          cashmore_point?: number;
          created_at?: string;
          error_code?: string | null;
          exchange_rate?: number;
          id?: string;
          naver_pay_account_id?: string | null;
          naverpay_point?: number;
          partner_tx_no?: string | null;
          point_action_id?: number | null;
          processed_at?: string | null;
          status?: string;
          tx_no?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'naver_pay_exchanges_naver_pay_account_id_fkey';
            columns: ['naver_pay_account_id'];
            isOneToOne: false;
            referencedRelation: 'naver_pay_accounts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'naver_pay_exchanges_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      nickname_history: {
        Row: {
          after: string;
          before: string;
          created_at: string;
          id: number;
          user_id: string;
        };
        Insert: {
          after: string;
          before: string;
          created_at?: string;
          id?: number;
          user_id: string;
        };
        Update: {
          after?: string;
          before?: string;
          created_at?: string;
          id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'nickname_history_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      notices: {
        Row: {
          content: string;
          created_at: string;
          id: number;
          is_visible: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: number;
          is_visible?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: number;
          is_visible?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_log: {
        Row: {
          created_at: string;
          id: number;
          message: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          message?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          message?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_settings: {
        Row: {
          created_at: string;
          id: number;
          is_enabled: boolean;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          is_enabled?: boolean;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          is_enabled?: boolean;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notification_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      nps_surveys: {
        Row: {
          created_at: string;
          feedback: string | null;
          id: number;
          score: number;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          feedback?: string | null;
          id?: number;
          score: number;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          feedback?: string | null;
          id?: number;
          score?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'nps_surveys_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      ocr_comparison_logs: {
        Row: {
          created_at: string | null;
          id: number;
          image_url: string;
          receipt_id: number | null;
          vision_receipt_type: string | null;
          vision_result: Json | null;
          vision_score: number | null;
          vision_score_details: Json | null;
          vision_time_ms: number | null;
          vllm_error: string | null;
          vllm_receipt_type: string | null;
          vllm_result: Json | null;
          vllm_score: number | null;
          vllm_score_details: Json | null;
          vllm_success: boolean | null;
          vllm_time_ms: number | null;
        };
        Insert: {
          created_at?: string | null;
          id?: number;
          image_url: string;
          receipt_id?: number | null;
          vision_receipt_type?: string | null;
          vision_result?: Json | null;
          vision_score?: number | null;
          vision_score_details?: Json | null;
          vision_time_ms?: number | null;
          vllm_error?: string | null;
          vllm_receipt_type?: string | null;
          vllm_result?: Json | null;
          vllm_score?: number | null;
          vllm_score_details?: Json | null;
          vllm_success?: boolean | null;
          vllm_time_ms?: number | null;
        };
        Update: {
          created_at?: string | null;
          id?: number;
          image_url?: string;
          receipt_id?: number | null;
          vision_receipt_type?: string | null;
          vision_result?: Json | null;
          vision_score?: number | null;
          vision_score_details?: Json | null;
          vision_time_ms?: number | null;
          vllm_error?: string | null;
          vllm_receipt_type?: string | null;
          vllm_result?: Json | null;
          vllm_score?: number | null;
          vllm_score_details?: Json | null;
          vllm_success?: boolean | null;
          vllm_time_ms?: number | null;
        };
        Relationships: [];
      };
      partner_user: {
        Row: {
          additional_data: Json | null;
          auth_id: string;
          created_at: string;
          id: number;
        };
        Insert: {
          additional_data?: Json | null;
          auth_id: string;
          created_at?: string;
          id?: number;
        };
        Update: {
          additional_data?: Json | null;
          auth_id?: string;
          created_at?: string;
          id?: number;
        };
        Relationships: [];
      };
      partner_user_retailer_relation: {
        Row: {
          created_at: string;
          id: number;
          retailer_id: number;
          user_id: number;
        };
        Insert: {
          created_at?: string;
          id?: number;
          retailer_id: number;
          user_id: number;
        };
        Update: {
          created_at?: string;
          id?: number;
          retailer_id?: number;
          user_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'partner_user_relation_retailer_id_fkey';
            columns: ['retailer_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'partner_user_relation_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'partner_user';
            referencedColumns: ['id'];
          },
        ];
      };
      point_actions: {
        Row: {
          additional_data: Json;
          created_at: string;
          id: number;
          point_amount: number;
          status: string;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          additional_data?: Json;
          created_at?: string;
          id?: number;
          point_amount?: number;
          status?: string;
          type: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          additional_data?: Json;
          created_at?: string;
          id?: number;
          point_amount?: number;
          status?: string;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'point_actions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      prompts: {
        Row: {
          content: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      referral_invitation: {
        Row: {
          created_at: string;
          id: number;
          referral_code: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          referral_code: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          referral_code?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'referral_invitation_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      referral_referee: {
        Row: {
          created_at: string;
          id: number;
          referrer_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          referrer_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          referrer_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'referral_referee_referrer_id_fkey';
            columns: ['referrer_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'referral_referee_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      referral_reward: {
        Row: {
          created_at: string;
          id: number;
          price: number;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          price: number;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          price?: number;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'referral_reward_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      repeat_cashback_events: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          started_at: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id: string;
          started_at?: string;
          status: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'repeat_cashback_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      reward_point: {
        Row: {
          amount: number;
          claim_id: number | null;
          created_at: string;
          from_user_id: string | null;
          id: number;
          status: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          amount: number;
          claim_id?: number | null;
          created_at?: string;
          from_user_id?: string | null;
          id?: number;
          status?: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          amount?: number;
          claim_id?: number | null;
          created_at?: string;
          from_user_id?: string | null;
          id?: number;
          status?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reward_point_claim_id_fkey';
            columns: ['claim_id'];
            isOneToOne: false;
            referencedRelation: 'claim';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reward_point_from_user_id_fkey';
            columns: ['from_user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reward_point_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      search_info: {
        Row: {
          id: number;
          update_at: string;
          user_id: string;
        };
        Insert: {
          id?: number;
          update_at?: string;
          user_id: string;
        };
        Update: {
          id?: number;
          update_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'search_info_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      step_level_claims: {
        Row: {
          claim_date: string;
          created_at: string;
          current_step_count: number;
          id: number;
          level: number;
          required_steps: number | null;
          user_id: string;
        };
        Insert: {
          claim_date: string;
          created_at?: string;
          current_step_count: number;
          id?: number;
          level: number;
          required_steps?: number | null;
          user_id?: string;
        };
        Update: {
          claim_date?: string;
          created_at?: string;
          current_step_count?: number;
          id?: number;
          level?: number;
          required_steps?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'step_level_claims_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      step_rewards: {
        Row: {
          created_at: string;
          id: number;
          point_amount: number | null;
          rewarded_date: string;
          step_count: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          point_amount?: number | null;
          rewarded_date: string;
          step_count: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          point_amount?: number | null;
          rewarded_date?: string;
          step_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'step_rewards_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      team_mission: {
        Row: {
          created_at: string;
          id: number;
          invitation_code: string;
          status: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          invitation_code?: string;
          status?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          invitation_code?: string;
          status?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'team_mission_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      team_mission_participants: {
        Row: {
          created_at: string;
          id: number;
          paid_at: string | null;
          status: string;
          team_mission_id: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          paid_at?: string | null;
          status?: string;
          team_mission_id?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          paid_at?: string | null;
          status?: string;
          team_mission_id?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'team_mission_participants_team_mission_id_fkey';
            columns: ['team_mission_id'];
            isOneToOne: false;
            referencedRelation: 'team_mission';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'team_mission_participants_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      ticket_surveys: {
        Row: {
          age_group: string;
          brands: string[];
          created_at: string;
          gender: string;
          id: number;
          lifestyles: string[];
          user_id: string;
        };
        Insert: {
          age_group: string;
          brands: string[];
          created_at?: string;
          gender: string;
          id?: number;
          lifestyles: string[];
          user_id: string;
        };
        Update: {
          age_group?: string;
          brands?: string[];
          created_at?: string;
          gender?: string;
          id?: number;
          lifestyles?: string[];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ticket_surveys_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      tracking_event: {
        Row: {
          created_at: string;
          id: number;
          properties: Json | null;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          properties?: Json | null;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          properties?: Json | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tracking_event_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      user: {
        Row: {
          app_version: string | null;
          auth_id: string | null;
          created_at: string;
          device_id: string | null;
          email: string | null;
          fcm_token: string;
          id: string;
          is_banned: boolean;
          is_push_enabled: boolean | null;
          marketing_info: boolean;
          marketing_info_updated_at: string | null;
          nickname: string | null;
          platform: string | null;
          provider: string | null;
        };
        Insert: {
          app_version?: string | null;
          auth_id?: string | null;
          created_at?: string;
          device_id?: string | null;
          email?: string | null;
          fcm_token?: string;
          id?: string;
          is_banned?: boolean;
          is_push_enabled?: boolean | null;
          marketing_info: boolean;
          marketing_info_updated_at?: string | null;
          nickname?: string | null;
          platform?: string | null;
          provider?: string | null;
        };
        Update: {
          app_version?: string | null;
          auth_id?: string | null;
          created_at?: string;
          device_id?: string | null;
          email?: string | null;
          fcm_token?: string;
          id?: string;
          is_banned?: boolean;
          is_push_enabled?: boolean | null;
          marketing_info?: boolean;
          marketing_info_updated_at?: string | null;
          nickname?: string | null;
          platform?: string | null;
          provider?: string | null;
        };
        Relationships: [];
      };
      user_data: {
        Row: {
          created_at: string;
          id: number;
          identifier: string;
          raw_data: Json | null;
          status: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: number;
          identifier: string;
          raw_data?: Json | null;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: number;
          identifier?: string;
          raw_data?: Json | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_data_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      user_info: {
        Row: {
          created_at: string;
          id: number;
          name: string;
          phone_number: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          name?: string;
          phone_number: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          name?: string;
          phone_number?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_location_engagement: {
        Row: {
          created_at: string;
          date: string;
          every_receipt_count: number;
          every_receipt_unique_user_count: number;
          id: number;
          sigungu_code: number;
          sigungu_name: string;
        };
        Insert: {
          created_at?: string;
          date: string;
          every_receipt_count?: number;
          every_receipt_unique_user_count?: number;
          id?: number;
          sigungu_code: number;
          sigungu_name: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          every_receipt_count?: number;
          every_receipt_unique_user_count?: number;
          id?: number;
          sigungu_code?: number;
          sigungu_name?: string;
        };
        Relationships: [];
      };
      user_location_engagement_time_series: {
        Row: {
          created_at: string;
          date: string;
          id: number;
          rank: number;
          sigungu_code: string;
          sigungu_name: string;
          time: string;
          today_cumulative_count: number;
          yesterday_cumulative_count: number;
        };
        Insert: {
          created_at?: string;
          date: string;
          id?: number;
          rank: number;
          sigungu_code: string;
          sigungu_name: string;
          time: string;
          today_cumulative_count: number;
          yesterday_cumulative_count: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: number;
          rank?: number;
          sigungu_code?: string;
          sigungu_name?: string;
          time?: string;
          today_cumulative_count?: number;
          yesterday_cumulative_count?: number;
        };
        Relationships: [];
      };
      user_payment_data: {
        Row: {
          amount: number;
          created_at: string;
          id: number;
          location: unknown;
          location_title: string;
          timestamp: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: number;
          location?: unknown;
          location_title: string;
          timestamp: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: number;
          location?: unknown;
          location_title?: string;
          timestamp?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_payment_data_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      user_point_balance: {
        Row: {
          created_at: string;
          last_point_action_id: number;
          total_point: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          last_point_action_id: number;
          total_point?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          last_point_action_id?: number;
          total_point?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_point_balance_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      user_point_snapshots: {
        Row: {
          created_at: string;
          id: number;
          point_balance: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          point_balance: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          point_balance?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_point_snapshots_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
      verification_codes: {
        Row: {
          code: string;
          created_at: string;
          id: number;
          phone_number: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: number;
          phone_number: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: number;
          phone_number?: string;
        };
        Relationships: [];
      };
      want_partner: {
        Row: {
          created_at: string;
          id: number;
          location_id: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: number;
          location_id: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: number;
          location_id?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'want_partner_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'location_info';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'want_partner_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      decrease_claim_discount: {
        Args: { p_retailer_id: number; p_user_id: string };
        Returns: Json;
      };
      distribute_dividend_by_tier: {
        Args: {
          batch_size?: number;
          max_receipts: number;
          min_receipts: number;
          point_amount: number;
          target_month: number;
          target_year: number;
          test_user_ids?: string[];
          tier_name: string;
          tier_percentile?: number;
        };
        Returns: Json;
      };
      get_abuse_suspect_detail: {
        Args: { p_user_id: string };
        Returns: {
          cash_pending_amount: number;
          gap_from_prev_min: number;
          invitee_email: string;
          invitee_first_ip: unknown;
          invitee_id: string;
          invitee_signup_at: string;
          inviter_created_at: string;
          inviter_email: string;
          inviter_ip: unknown;
          inviter_nickname: string;
          inviter_platform: string;
          is_same_ip: boolean;
          naverpay_pending_pt: number;
        }[];
      };
      get_ad_lottery_stats: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: Json;
      };
      get_all_location_info_as_lat_long: {
        Args: never;
        Returns: {
          address: string;
          category: string;
          custom_cashback_text: string;
          description: string;
          id: number;
          image_url: string;
          instagram_url: string;
          is_partner: boolean;
          latitude: number;
          logo_url: string;
          longitude: number;
          max_discount: number;
          min_discount: number;
          naver_place_url: string;
          title: string;
          working_hours: Json;
        }[];
      };
      get_all_location_info_discount_as_lat_long: {
        Args: never;
        Returns: {
          address: string;
          category: string;
          description: string;
          id: number;
          latitude: number;
          logo_url: string;
          longitude: number;
          max_discount: number;
          min_discount: number;
          title: string;
        }[];
      };
      get_attendance_lottery_stats: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: Json;
      };
      get_channels: {
        Args: never;
        Returns: {
          channel: string;
        }[];
      };
      get_daily_point_stats: {
        Args: { end_date: string; start_date: string };
        Returns: Json;
      };
      get_distinct_records: {
        Args: never;
        Returns: {
          created_at: string;
          id: number;
          search_position: unknown;
          user_id: string;
        }[];
      };
      get_empty_analysis_receipts: {
        Args: never;
        Returns: {
          analysis: Json;
          created_at: string;
          id: number;
          image_url: string;
        }[];
      };
      get_first_session_ip: {
        Args: { target_user_id: string };
        Returns: string;
      };
      get_first_session_ips: {
        Args: { target_user_ids: string[] };
        Returns: {
          ip: string;
          user_id: string;
        }[];
      };
      get_latest_session_ip: {
        Args: { target_user_id: string };
        Returns: string;
      };
      get_latest_session_ips: {
        Args: { target_user_ids: string[] };
        Returns: {
          ip: string;
          user_id: string;
        }[];
      };
      get_location_info_by_id: {
        Args: { location_id: number };
        Returns: {
          address: string;
          category: string;
          description: string;
          id: number;
          latitude: number;
          logo_url: string;
          longitude: number;
          title: string;
        }[];
      };
      get_location_info_by_ids: {
        Args: { location_ids: number[] };
        Returns: {
          address: string;
          category: string;
          description: string;
          id: number;
          latitude: number;
          logo_url: string;
          longitude: number;
          title: string;
        }[];
      };
      get_nearby_location_info: {
        Args: { distance_km?: number; lat: number; lng: number };
        Returns: {
          address: string;
          category: string;
          description: string;
          distance: number;
          id: number;
          latitude: number;
          logo_url: string;
          longitude: number;
          title: string;
        }[];
      };
      get_pedometer_lottery_stats: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: Json;
      };
      get_pending_abuse_suspects: {
        Args: { p_min_pct?: number; p_min_same_ip?: number };
        Returns: {
          cash_pending_amount: number;
          email: string;
          naverpay_pending_pt: number;
          same_ip_count: number;
          same_ip_pct: number;
          total_invitees: number;
          total_pending_amount: number;
          user_id: string;
        }[];
      };
      get_receipt_lottery_stats: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: Json;
      };
      get_receipt_point_stats: {
        Args: { p_end_date: string; p_start_date: string };
        Returns: Json;
      };
      get_receipt_user_distribution: {
        Args: { end_date: string; start_date: string };
        Returns: Json;
      };
      get_score_combinations: {
        Args: { p_days?: number };
        Returns: {
          count: number;
          date_validity: number;
          image_quality: number;
          items: number;
          payment_amount: number;
          payment_method: number;
          receipt_type: number;
          same_store: number;
          store_details: number;
          store_name: number;
          total_score: number;
        }[];
      };
      get_target_app_version_list: {
        Args: {
          app_platform: Database['public']['Enums']['platforms'];
          min_bundle_id: string;
        };
        Returns: {
          target_app_version: string;
        }[];
      };
      get_today_receipt_stats: {
        Args: { end_date: string; start_date: string };
        Returns: Json;
      };
      get_top_users_by_points: {
        Args: { end_date: string; limit_count?: number; start_date: string };
        Returns: Json;
      };
      get_unique_landings: {
        Args: never;
        Returns: {
          created_at: string;
          id: number;
          position: unknown;
          user_id: string;
        }[];
      };
      get_update_info_by_app_version: {
        Args: {
          app_platform: Database['public']['Enums']['platforms'];
          app_version: string;
          bundle_id: string;
          min_bundle_id: string;
          target_app_version_list: string[];
          target_channel: string;
        };
        Returns: {
          file_hash: string;
          id: string;
          message: string;
          should_force_update: boolean;
          status: string;
          storage_uri: string;
        }[];
      };
      get_update_info_by_fingerprint_hash: {
        Args: {
          app_platform: Database['public']['Enums']['platforms'];
          bundle_id: string;
          min_bundle_id: string;
          target_channel: string;
          target_fingerprint_hash: string;
        };
        Returns: {
          file_hash: string;
          id: string;
          message: string;
          should_force_update: boolean;
          status: string;
          storage_uri: string;
        }[];
      };
      get_user_streaks: {
        Args: { p_days?: number; p_user_id: string };
        Returns: {
          continuous_count: number;
          end_date: string;
          start_date: string;
        }[];
      };
      get_users_by_location: {
        Args: { lat: number; lng: number; radius_m: number };
        Returns: {
          distance: number;
          user_id: string;
        }[];
      };
      http: {
        Args: { request: Database['public']['CompositeTypes']['http_request'] };
        Returns: Database['public']['CompositeTypes']['http_response'];
        SetofOptions: {
          from: 'http_request';
          to: 'http_response';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      http_delete:
        | {
            Args: { uri: string };
            Returns: Database['public']['CompositeTypes']['http_response'];
            SetofOptions: {
              from: '*';
              to: 'http_response';
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: { content: string; content_type: string; uri: string };
            Returns: Database['public']['CompositeTypes']['http_response'];
            SetofOptions: {
              from: '*';
              to: 'http_response';
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      http_get:
        | {
            Args: { uri: string };
            Returns: Database['public']['CompositeTypes']['http_response'];
            SetofOptions: {
              from: '*';
              to: 'http_response';
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: { data: Json; uri: string };
            Returns: Database['public']['CompositeTypes']['http_response'];
            SetofOptions: {
              from: '*';
              to: 'http_response';
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      http_head: {
        Args: { uri: string };
        Returns: Database['public']['CompositeTypes']['http_response'];
        SetofOptions: {
          from: '*';
          to: 'http_response';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      http_header: {
        Args: { field: string; value: string };
        Returns: Database['public']['CompositeTypes']['http_header'];
        SetofOptions: {
          from: '*';
          to: 'http_header';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      http_list_curlopt: {
        Args: never;
        Returns: {
          curlopt: string;
          value: string;
        }[];
      };
      http_patch: {
        Args: { content: string; content_type: string; uri: string };
        Returns: Database['public']['CompositeTypes']['http_response'];
        SetofOptions: {
          from: '*';
          to: 'http_response';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string };
            Returns: Database['public']['CompositeTypes']['http_response'];
            SetofOptions: {
              from: '*';
              to: 'http_response';
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: { data: Json; uri: string };
            Returns: Database['public']['CompositeTypes']['http_response'];
            SetofOptions: {
              from: '*';
              to: 'http_response';
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      http_put: {
        Args: { content: string; content_type: string; uri: string };
        Returns: Database['public']['CompositeTypes']['http_response'];
        SetofOptions: {
          from: '*';
          to: 'http_response';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      http_reset_curlopt: { Args: never; Returns: boolean };
      http_set_curlopt: {
        Args: { curlopt: string; value: string };
        Returns: boolean;
      };
      increment_banner_ad_stat: {
        Args: { p_ad_id: number; p_event_type: string };
        Returns: undefined;
      };
      rollback_dividend_by_tier: {
        Args: {
          target_month: number;
          target_tier?: string;
          target_year: number;
        };
        Returns: Json;
      };
      sum_user_points: { Args: { p_user_id: string }; Returns: number };
      sum_user_points_up_to_id: {
        Args: { p_max_id: number; p_user_id: string };
        Returns: number;
      };
      upsert_user_point_balance: {
        Args: { p_delta: number; p_new_id: number; p_user_id: string };
        Returns: undefined;
      };
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string };
            Returns: {
              error: true;
            } & 'Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved';
          };
    };
    Enums: {
      claim_status:
        | 'processing'
        | 'reported'
        | 'confirmed'
        | 'completed'
        | 'rejected'
        | 'cancelled';
      platforms: 'ios' | 'android';
      reward_type: 'rate' | 'fixed_rate';
    };
    CompositeTypes: {
      http_header: {
        field: string | null;
        value: string | null;
      };
      http_request: {
        method: unknown;
        uri: string | null;
        headers: Database['public']['CompositeTypes']['http_header'][] | null;
        content_type: string | null;
        content: string | null;
      };
      http_response: {
        status: number | null;
        content_type: string | null;
        headers: Database['public']['CompositeTypes']['http_header'][] | null;
        content: string | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      claim_status: [
        'processing',
        'reported',
        'confirmed',
        'completed',
        'rejected',
        'cancelled',
      ],
      platforms: ['ios', 'android'],
      reward_type: ['rate', 'fixed_rate'],
    },
  },
} as const;
