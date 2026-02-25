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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          completed_at: string | null
          contact_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_completed: boolean | null
          pipeline_card_id: string | null
          responsible_id: string | null
          scheduled_for: string
          subject: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          pipeline_card_id?: string | null
          responsible_id?: string | null
          scheduled_for: string
          subject: string
          type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_completed?: boolean | null
          pipeline_card_id?: string | null
          responsible_id?: string | null
          scheduled_for?: string
          subject?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_pipeline_card_id_fkey"
            columns: ["pipeline_card_id"]
            isOneToOne: false
            referencedRelation: "pipeline_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activities_org"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_activities_org"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      ai_agent_knowledge_files: {
        Row: {
          agent_id: string
          content_extracted: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          is_processed: boolean | null
        }
        Insert: {
          agent_id: string
          content_extracted?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          is_processed?: boolean | null
        }
        Update: {
          agent_id?: string
          content_extracted?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_processed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_knowledge_files_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          api_key_encrypted: string | null
          api_provider: string
          assign_responsible: boolean | null
          auto_responses_enabled: boolean | null
          configure_commands: string | null
          created_at: string
          description: string | null
          disable_outside_platform: boolean | null
          fallback_message: string | null
          id: string
          ignore_interval: number | null
          is_active: boolean | null
          is_default: boolean | null
          knowledge_base_enabled: boolean | null
          knowledge_base_url: string | null
          max_messages: number | null
          max_tokens: number | null
          model: string
          name: string
          process_messages: boolean | null
          reasoning_effort: string | null
          response_delay_ms: number | null
          split_responses: boolean | null
          system_instructions: string | null
          temperature: number | null
          updated_at: string
          working_days: number[] | null
          working_hours_enabled: boolean | null
          working_hours_end: string | null
          working_hours_start: string | null
          workspace_id: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_provider?: string
          assign_responsible?: boolean | null
          auto_responses_enabled?: boolean | null
          configure_commands?: string | null
          created_at?: string
          description?: string | null
          disable_outside_platform?: boolean | null
          fallback_message?: string | null
          id?: string
          ignore_interval?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          knowledge_base_enabled?: boolean | null
          knowledge_base_url?: string | null
          max_messages?: number | null
          max_tokens?: number | null
          model?: string
          name: string
          process_messages?: boolean | null
          reasoning_effort?: string | null
          response_delay_ms?: number | null
          split_responses?: boolean | null
          system_instructions?: string | null
          temperature?: number | null
          updated_at?: string
          working_days?: number[] | null
          working_hours_enabled?: boolean | null
          working_hours_end?: string | null
          working_hours_start?: string | null
          workspace_id?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_provider?: string
          assign_responsible?: boolean | null
          auto_responses_enabled?: boolean | null
          configure_commands?: string | null
          created_at?: string
          description?: string | null
          disable_outside_platform?: boolean | null
          fallback_message?: string | null
          id?: string
          ignore_interval?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          knowledge_base_enabled?: boolean | null
          knowledge_base_url?: string | null
          max_messages?: number | null
          max_tokens?: number | null
          model?: string
          name?: string
          process_messages?: boolean | null
          reasoning_effort?: string | null
          response_delay_ms?: number | null
          split_responses?: boolean | null
          system_instructions?: string | null
          temperature?: number | null
          updated_at?: string
          working_days?: number[] | null
          working_hours_enabled?: boolean | null
          working_hours_end?: string | null
          working_hours_start?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          automation_id: string
          card_id: string
          column_id: string
          executed_at: string
          id: string
          trigger_type: string
          workspace_id: string
        }
        Insert: {
          automation_id: string
          card_id: string
          column_id: string
          executed_at?: string
          id?: string
          trigger_type: string
          workspace_id: string
        }
        Update: {
          automation_id?: string
          card_id?: string
          column_id?: string
          executed_at?: string
          id?: string
          trigger_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_column_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "pipeline_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "pipeline_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      base_de_conhecimento: {
        Row: {
          contexto: string | null
          created_at: string
          id: string
          id_agent: string | null
        }
        Insert: {
          contexto?: string | null
          created_at?: string
          id?: string
          id_agent?: string | null
        }
        Update: {
          contexto?: string | null
          created_at?: string
          id?: string
          id_agent?: string | null
        }
        Relationships: []
      }
      cargos: {
        Row: {
          created_at: string
          funcao: string | null
          id: string
          is_active: boolean | null
          nome: string
          permissions: Json | null
          tipo: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          funcao?: string | null
          id?: string
          is_active?: boolean | null
          nome: string
          permissions?: Json | null
          tipo: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          funcao?: string | null
          id?: string
          is_active?: boolean | null
          nome?: string
          permissions?: Json | null
          tipo?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cep: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string
          data_cadastro: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          metadata: Json | null
          nome: string
          observacoes: string | null
          status: string
          telefone: string | null
          tipo_pessoa: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          metadata?: Json | null
          nome: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          metadata?: Json | null
          nome?: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          tipo_pessoa?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      connection_secrets: {
        Row: {
          connection_id: string
          created_at: string | null
          evolution_url: string
          id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string | null
          evolution_url: string
          id?: string
          token: string
          updated_at?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string | null
          evolution_url?: string
          id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connection_secrets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          auto_create_crm_card: boolean | null
          created_at: string | null
          default_column_id: string | null
          default_column_name: string | null
          default_pipeline_id: string | null
          history_days: number | null
          history_messages_synced: number | null
          history_recovery: string | null
          history_status: string | null
          history_sync_completed_at: string | null
          history_sync_started_at: string | null
          history_sync_status: string | null
          id: string
          instance_name: string
          is_default: boolean
          last_activity_at: string | null
          metadata: Json | null
          phone_number: string | null
          provider_id: string | null
          qr_code: string | null
          queue_id: string | null
          status: string
          updated_at: string | null
          use_workspace_default: boolean | null
          workspace_id: string
        }
        Insert: {
          auto_create_crm_card?: boolean | null
          created_at?: string | null
          default_column_id?: string | null
          default_column_name?: string | null
          default_pipeline_id?: string | null
          history_days?: number | null
          history_messages_synced?: number | null
          history_recovery?: string | null
          history_status?: string | null
          history_sync_completed_at?: string | null
          history_sync_started_at?: string | null
          history_sync_status?: string | null
          id?: string
          instance_name: string
          is_default?: boolean
          last_activity_at?: string | null
          metadata?: Json | null
          phone_number?: string | null
          provider_id?: string | null
          qr_code?: string | null
          queue_id?: string | null
          status?: string
          updated_at?: string | null
          use_workspace_default?: boolean | null
          workspace_id: string
        }
        Update: {
          auto_create_crm_card?: boolean | null
          created_at?: string | null
          default_column_id?: string | null
          default_column_name?: string | null
          default_pipeline_id?: string | null
          history_days?: number | null
          history_messages_synced?: number | null
          history_recovery?: string | null
          history_status?: string | null
          history_sync_completed_at?: string | null
          history_sync_started_at?: string | null
          history_sync_status?: string | null
          id?: string
          instance_name?: string
          is_default?: boolean
          last_activity_at?: string | null
          metadata?: Json | null
          phone_number?: string | null
          provider_id?: string | null
          qr_code?: string | null
          queue_id?: string | null
          status?: string
          updated_at?: string | null
          use_workspace_default?: boolean | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_default_column_id_fkey"
            columns: ["default_column_id"]
            isOneToOne: false
            referencedRelation: "pipeline_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_default_pipeline_id_fkey"
            columns: ["default_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      contact_extra_info: {
        Row: {
          contact_id: string
          created_at: string
          field_name: string
          field_value: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          field_name: string
          field_value: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          field_name?: string
          field_value?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_extra_info_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_extra_info_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_observations: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          created_by: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      contact_tags: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          extra_info: Json | null
          id: string
          name: string
          phone: string | null
          profile_fetch_attempts: number | null
          profile_fetch_last_attempt: string | null
          profile_image_updated_at: string | null
          profile_image_url: string | null
          updated_at: string
          whatsapp_lid: string | null
          workspace_id: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          extra_info?: Json | null
          id?: string
          name: string
          phone?: string | null
          profile_fetch_attempts?: number | null
          profile_fetch_last_attempt?: string | null
          profile_image_updated_at?: string | null
          profile_image_url?: string | null
          updated_at?: string
          whatsapp_lid?: string | null
          workspace_id: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          extra_info?: Json | null
          id?: string
          name?: string
          phone?: string | null
          profile_fetch_attempts?: number | null
          profile_fetch_last_attempt?: string | null
          profile_image_updated_at?: string | null
          profile_image_url?: string | null
          updated_at?: string
          whatsapp_lid?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      conversation_agent_history: {
        Row: {
          action: string
          agent_id: string | null
          agent_name: string
          changed_by: string | null
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          agent_id?: string | null
          agent_name: string
          changed_by?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          agent_id?: string | null
          agent_name?: string
          changed_by?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_agent_history_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_agent_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_agent_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_agent_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_assignments: {
        Row: {
          action: string
          changed_at: string
          changed_by: string
          conversation_id: string
          from_assigned_user_id: string | null
          from_queue_id: string | null
          id: string
          to_assigned_user_id: string | null
          to_queue_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by: string
          conversation_id: string
          from_assigned_user_id?: string | null
          from_queue_id?: string | null
          id?: string
          to_assigned_user_id?: string | null
          to_queue_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string
          conversation_id?: string
          from_assigned_user_id?: string | null
          from_queue_id?: string | null
          id?: string
          to_assigned_user_id?: string | null
          to_queue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignments_from_queue_id_fkey"
            columns: ["from_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_assignments_to_queue_id_fkey"
            columns: ["to_queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          left_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_tags: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          tag_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          tag_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_active_id: string | null
          agente_ativo: boolean | null
          assigned_at: string | null
          assigned_user_id: string | null
          canal: string | null
          connection_id: string | null
          contact_id: string
          created_at: string
          evolution_instance: string | null
          id: string
          instance_phone: string | null
          last_activity_at: string | null
          last_message_at: string | null
          priority: string | null
          queue_id: string | null
          status: string
          unread_count: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_active_id?: string | null
          agente_ativo?: boolean | null
          assigned_at?: string | null
          assigned_user_id?: string | null
          canal?: string | null
          connection_id?: string | null
          contact_id: string
          created_at?: string
          evolution_instance?: string | null
          id?: string
          instance_phone?: string | null
          last_activity_at?: string | null
          last_message_at?: string | null
          priority?: string | null
          queue_id?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_active_id?: string | null
          agente_ativo?: boolean | null
          assigned_at?: string | null
          assigned_user_id?: string | null
          canal?: string | null
          connection_id?: string | null
          contact_id?: string
          created_at?: string
          evolution_instance?: string | null
          id?: string
          instance_phone?: string | null
          last_activity_at?: string | null
          last_message_at?: string | null
          priority?: string | null
          queue_id?: string | null
          status?: string
          unread_count?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_active_id_fkey"
            columns: ["agent_active_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_connection_fk"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
          {
            foreignKeyName: "fk_conversations_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversations_contact_id"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_conversations_queue_id"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_automation_executions: {
        Row: {
          automation_id: string
          card_id: string
          column_id: string
          created_at: string
          executed_at: string
          execution_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          automation_id: string
          card_id: string
          column_id: string
          created_at?: string
          executed_at?: string
          execution_type?: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          automation_id?: string
          card_id?: string
          column_id?: string
          created_at?: string
          executed_at?: string
          execution_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_automation_executions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_column_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_executions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "pipeline_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automation_executions_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "pipeline_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_column_automation_actions: {
        Row: {
          action_config: Json
          action_order: number
          action_type: string
          automation_id: string
          created_at: string
          id: string
        }
        Insert: {
          action_config?: Json
          action_order?: number
          action_type: string
          automation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          action_config?: Json
          action_order?: number
          action_type?: string
          automation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_column_automation_actions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_column_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_column_automation_triggers: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          trigger_config: Json | null
          trigger_type: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          trigger_config?: Json | null
          trigger_type: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          trigger_config?: Json | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_column_automation_triggers_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "crm_column_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_column_automations: {
        Row: {
          column_id: string
          created_at: string
          description: string | null
          id: string
          ignore_business_hours: boolean
          is_active: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          column_id: string
          created_at?: string
          description?: string | null
          id?: string
          ignore_business_hours?: boolean
          is_active?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          column_id?: string
          created_at?: string
          description?: string | null
          id?: string
          ignore_business_hours?: boolean
          is_active?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_column_automations_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "pipeline_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_column_automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_column_automations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      dashboard_cards: {
        Row: {
          action_url: string | null
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          metadata: Json | null
          order_position: number
          title: string
          type: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json | null
          order_position?: number
          title: string
          type: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          metadata?: Json | null
          order_position?: number
          title?: string
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      documents_base: {
        Row: {
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          text: string
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          text: string
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          text?: string
        }
        Relationships: []
      }
      evolution_instance_tokens: {
        Row: {
          created_at: string
          evolution_url: string
          id: string
          instance_name: string
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          evolution_url: string
          id?: string
          instance_name: string
          token: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          evolution_url?: string
          id?: string
          instance_name?: string
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_instance_tokens_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolution_instance_tokens_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      google_calendar_authorizations: {
        Row: {
          authorized_at: string
          created_at: string
          google_email: string
          google_user_id: string | null
          id: string
          last_token_check_at: string | null
          refresh_token: string
          revoked_at: string | null
          scopes: string[]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          authorized_at?: string
          created_at?: string
          google_email: string
          google_user_id?: string | null
          id?: string
          last_token_check_at?: string | null
          refresh_token: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          authorized_at?: string
          created_at?: string
          google_email?: string
          google_user_id?: string | null
          id?: string
          last_token_check_at?: string | null
          refresh_token?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_authorizations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_authorizations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      google_calendar_oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          expires_at: string
          state: string
          used_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          expires_at: string
          state: string
          used_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          expires_at?: string
          state?: string
          used_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_calendar_oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_oauth_states_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_oauth_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_calendar_oauth_states_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      instance_user_assignments: {
        Row: {
          created_at: string
          id: string
          instance: string
          is_default: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance: string
          is_default?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instance?: string
          is_default?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      internal_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          participants: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          participants?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          participants?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      internal_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          message_type: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived_at: string | null
          converted_at: string | null
          converted_deal_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          name: string | null
          owner_user_id: string | null
          source: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          converted_at?: string | null
          converted_deal_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string | null
          owner_user_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          converted_at?: string | null
          converted_deal_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string | null
          owner_user_id?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_deal_id_fkey"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "pipeline_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      loss_reasons: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loss_reasons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loss_reasons_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          evolution_key_id: string | null
          evolution_short_key_id: string | null
          external_id: string | null
          file_name: string | null
          file_url: string | null
          id: string
          message_type: string
          metadata: Json | null
          mime_type: string | null
          origem_resposta: string | null
          quoted_message: Json | null
          read_at: string | null
          reply_to_message_id: string | null
          sender_id: string | null
          sender_type: string
          status: string | null
          workspace_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          evolution_key_id?: string | null
          evolution_short_key_id?: string | null
          external_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          mime_type?: string | null
          origem_resposta?: string | null
          quoted_message?: Json | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_type: string
          status?: string | null
          workspace_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          evolution_key_id?: string | null
          evolution_short_key_id?: string | null
          external_id?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          mime_type?: string | null
          origem_resposta?: string | null
          quoted_message?: Json | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_type?: string
          status?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_messages_conversation_id"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          contact_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          message_type: string
          read_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          contact_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          message_type?: string
          read_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          contact_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          message_type?: string
          read_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      pipeline_actions: {
        Row: {
          action_name: string
          button_color: string | null
          created_at: string | null
          deal_state: string
          id: string
          order_position: number | null
          pipeline_id: string
          target_column_id: string
          target_pipeline_id: string
          updated_at: string | null
        }
        Insert: {
          action_name: string
          button_color?: string | null
          created_at?: string | null
          deal_state: string
          id?: string
          order_position?: number | null
          pipeline_id: string
          target_column_id: string
          target_pipeline_id: string
          updated_at?: string | null
        }
        Update: {
          action_name?: string
          button_color?: string | null
          created_at?: string | null
          deal_state?: string
          id?: string
          order_position?: number | null
          pipeline_id?: string
          target_column_id?: string
          target_pipeline_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_actions_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_actions_target_column_id_fkey"
            columns: ["target_column_id"]
            isOneToOne: false
            referencedRelation: "pipeline_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_actions_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_card_history: {
        Row: {
          action: string
          card_id: string
          changed_at: string
          changed_by: string | null
          id: string
          metadata: Json | null
          workspace_id: string
        }
        Insert: {
          action: string
          card_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          workspace_id: string
        }
        Update: {
          action?: string
          card_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          metadata?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_card_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "pipeline_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_card_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_card_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      pipeline_cards: {
        Row: {
          column_id: string
          contact_id: string | null
          conversation_id: string | null
          connection_id: string | null
          created_at: string
          description: string | null
          id: string
          qualification: string
          loss_comments: string | null
          loss_reason_id: string | null
          moved_to_column_at: string | null
          pipeline_id: string
          responsible_user_id: string | null
          status: string
          tags: Json | null
          updated_at: string
          value: number | null
        }
        Insert: {
          column_id: string
          contact_id?: string | null
          conversation_id?: string | null
          connection_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          qualification?: string
          loss_comments?: string | null
          loss_reason_id?: string | null
          moved_to_column_at?: string | null
          pipeline_id: string
          responsible_user_id?: string | null
          status?: string
          tags?: Json | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          column_id?: string
          contact_id?: string | null
          conversation_id?: string | null
          connection_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          qualification?: string
          loss_comments?: string | null
          loss_reason_id?: string | null
          moved_to_column_at?: string | null
          pipeline_id?: string
          responsible_user_id?: string | null
          status?: string
          tags?: Json | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "pipeline_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_loss_reason_id_fkey"
            columns: ["loss_reason_id"]
            isOneToOne: false
            referencedRelation: "loss_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_cards_products: {
        Row: {
          created_at: string
          id: string
          is_recurring: boolean
          pipeline_card_id: string
          product_id: string | null
          product_name_snapshot: string | null
          quantity: number
          recurring_interval: string | null
          recurring_value: number | null
          total_value: number
          unit_value: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_recurring?: boolean
          pipeline_card_id: string
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity?: number
          recurring_interval?: string | null
          recurring_value?: number | null
          total_value?: number
          unit_value?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_recurring?: boolean
          pipeline_card_id?: string
          product_id?: string | null
          product_name_snapshot?: string | null
          quantity?: number
          recurring_interval?: string | null
          recurring_value?: number | null
          total_value?: number
          unit_value?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_cards_products_pipeline_card_id_fkey"
            columns: ["pipeline_card_id"]
            isOneToOne: false
            referencedRelation: "pipeline_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_cards_products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      pipeline_columns: {
        Row: {
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          order_position: number
          permissions: Json | null
          pipeline_id: string
          view_all_deals_permissions: Json | null
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          order_position?: number
          permissions?: Json | null
          pipeline_id: string
          view_all_deals_permissions?: Json | null
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          order_position?: number
          permissions?: Json | null
          pipeline_id?: string
          view_all_deals_permissions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_columns_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipelines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          value?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      provider_logs: {
        Row: {
          connection_id: string | null
          correlation_id: string
          created_at: string | null
          event_type: string
          id: string
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          connection_id?: string | null
          correlation_id: string
          created_at?: string | null
          event_type: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
        }
        Update: {
          connection_id?: string | null
          correlation_id?: string
          created_at?: string | null
          event_type?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      queue_users: {
        Row: {
          created_at: string | null
          id: string
          order_position: number | null
          queue_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_position?: number | null
          queue_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          order_position?: number | null
          queue_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "queue_users_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queue_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          ai_agent_id: string | null
          color: string | null
          created_at: string
          description: string | null
          distribution_type: string | null
          greeting_message: string | null
          id: string
          is_active: boolean
          last_assigned_user_index: number | null
          name: string
          order_position: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          ai_agent_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          distribution_type?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean
          last_assigned_user_index?: number | null
          name: string
          order_position?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          ai_agent_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          distribution_type?: string | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean
          last_assigned_user_index?: number | null
          name?: string
          order_position?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "queues_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "queues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      quick_audios: {
        Row: {
          created_at: string
          created_by_id: string | null
          duration_seconds: number | null
          file_name: string
          file_url: string
          id: string
          is_ai_agent: boolean | null
          title: string
          updated_at: string
          visible_to_all: boolean
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_id?: string | null
          duration_seconds?: number | null
          file_name: string
          file_url: string
          id?: string
          is_ai_agent?: boolean | null
          title: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_id?: string | null
          duration_seconds?: number | null
          file_name?: string
          file_url?: string
          id?: string
          is_ai_agent?: boolean | null
          title?: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id?: string
        }
        Relationships: []
      }
      quick_documents: {
        Row: {
          caption: string | null
          created_at: string
          created_by_id: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          is_ai_agent: boolean | null
          title: string
          updated_at: string
          visible_to_all: boolean
          workspace_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by_id?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          is_ai_agent?: boolean | null
          title: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by_id?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_ai_agent?: boolean | null
          title?: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id?: string
        }
        Relationships: []
      }
      quick_funnels: {
        Row: {
          created_at: string
          created_by_id: string | null
          id: string
          is_ai_agent: boolean | null
          steps: Json
          title: string
          updated_at: string
          visible_to_all: boolean
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by_id?: string | null
          id?: string
          is_ai_agent?: boolean | null
          steps?: Json
          title: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by_id?: string | null
          id?: string
          is_ai_agent?: boolean | null
          steps?: Json
          title?: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id?: string
        }
        Relationships: []
      }
      quick_media: {
        Row: {
          caption: string | null
          created_at: string
          created_by_id: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          is_ai_agent: boolean | null
          title: string
          updated_at: string
          visible_to_all: boolean
          workspace_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          created_by_id?: string | null
          file_name: string
          file_type: string
          file_url: string
          id?: string
          is_ai_agent?: boolean | null
          title: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          created_by_id?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          is_ai_agent?: boolean | null
          title?: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id?: string
        }
        Relationships: []
      }
      quick_messages: {
        Row: {
          allow_edit_before_send: boolean
          content: string
          created_at: string
          created_by_id: string | null
          id: string
          is_ai_agent: boolean | null
          title: string
          updated_at: string
          visible_to_all: boolean
          workspace_id: string
        }
        Insert: {
          allow_edit_before_send?: boolean
          content: string
          created_at?: string
          created_by_id?: string | null
          id?: string
          is_ai_agent?: boolean | null
          title: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id: string
        }
        Update: {
          allow_edit_before_send?: boolean
          content?: string
          created_at?: string
          created_by_id?: string | null
          id?: string
          is_ai_agent?: boolean | null
          title?: string
          updated_at?: string
          visible_to_all?: boolean
          workspace_id?: string
        }
        Relationships: []
      }
      report_audit_logs: {
        Row: {
          action: string
          created_at: string
          dashboard_id: string | null
          filters: Json | null
          id: string
          report_id: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          dashboard_id?: string | null
          filters?: Json | null
          id?: string
          report_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          dashboard_id?: string | null
          filters?: Json | null
          id?: string
          report_id?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      report_user_settings: {
        Row: {
          created_at: string
          id: string
          settings: Json
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_user_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      report_dashboard_cards: {
        Row: {
          created_at: string
          dashboard_id: string
          id: string
          layout: Json
          overrides: Json
          report_definition_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dashboard_id: string
          id?: string
          layout?: Json
          overrides?: Json
          report_definition_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dashboard_id?: string
          id?: string
          layout?: Json
          overrides?: Json
          report_definition_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_dashboard_cards_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "report_dashboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_dashboard_cards_report_definition_id_fkey"
            columns: ["report_definition_id"]
            isOneToOne: false
            referencedRelation: "report_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      report_dashboards: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filters: Json
          id: string
          layout: Json
          name: string
          sharing: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          layout?: Json
          name: string
          sharing?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filters?: Json
          id?: string
          layout?: Json
          name?: string
          sharing?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_dashboards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_dashboards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_dashboards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_dashboards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      report_definitions: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_template: boolean
          name: string
          tags: string[] | null
          type: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
          tags?: string[] | null
          type: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
          tags?: string[] | null
          type?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_definitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      system_customization: {
        Row: {
          background_color: string | null
          created_at: string
          favicon_url: string | null
          header_color: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          sidebar_color: string | null
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          created_at?: string
          favicon_url?: string | null
          header_color?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          sidebar_color?: string | null
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          created_at?: string
          favicon_url?: string | null
          header_color?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          sidebar_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_google_calendar_settings: {
        Row: {
          client_id: string
          client_secret: string
          created_at: string
          created_by: string | null
          id: string
          project_id: string | null
          redirect_uri: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          client_id: string
          client_secret: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string | null
          redirect_uri: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          client_id?: string
          client_secret?: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string | null
          redirect_uri?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      system_user_cargos: {
        Row: {
          cargo_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          cargo_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cargo_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_user_cargos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_user_cargos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
        ]
      }
      system_users: {
        Row: {
          avatar: string | null
          cargo_id: string | null
          created_at: string
          default_channel: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          profile: string
          senha: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          cargo_id?: string | null
          created_at?: string
          default_channel?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          profile: string
          senha?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          cargo_id?: string | null
          created_at?: string
          default_channel?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          profile?: string
          senha?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_workspace_fk"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          is_active: boolean
          session_token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          session_token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          session_token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          event_type: string | null
          id: string
          instance_id: string | null
          payload_json: Json | null
          response_body: string | null
          response_status: number | null
          status: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          instance_id?: string | null
          payload_json?: Json | null
          response_body?: string | null
          response_status?: number | null
          status?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string | null
          id?: string
          instance_id?: string | null
          payload_json?: Json | null
          response_body?: string | null
          response_status?: number | null
          status?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      whatsapp_provider_alert_config: {
        Row: {
          created_at: string
          email_notifications_enabled: boolean
          error_threshold_percent: number
          id: string
          is_active: boolean
          notification_emails: string[] | null
          provider: string
          time_window_minutes: number
          toast_notifications_enabled: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email_notifications_enabled?: boolean
          error_threshold_percent?: number
          id?: string
          is_active?: boolean
          notification_emails?: string[] | null
          provider: string
          time_window_minutes?: number
          toast_notifications_enabled?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email_notifications_enabled?: boolean
          error_threshold_percent?: number
          id?: string
          is_active?: boolean
          notification_emails?: string[] | null
          provider?: string
          time_window_minutes?: number
          toast_notifications_enabled?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_provider_alerts: {
        Row: {
          created_at: string
          error_count: number
          error_rate: number
          id: string
          notified_via: string[] | null
          provider: string
          threshold_percent: number
          time_window_end: string
          time_window_start: string
          total_messages: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          error_count: number
          error_rate: number
          id?: string
          notified_via?: string[] | null
          provider: string
          threshold_percent: number
          time_window_end: string
          time_window_start: string
          total_messages: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          error_count?: number
          error_rate?: number
          id?: string
          notified_via?: string[] | null
          provider?: string
          threshold_percent?: number
          time_window_end?: string
          time_window_start?: string
          total_messages?: number
          workspace_id?: string
        }
        Relationships: []
      }
      whatsapp_provider_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json | null
          provider: string
          result: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json | null
          provider: string
          result: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json | null
          provider?: string
          result?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_provider_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_provider_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      whatsapp_providers: {
        Row: {
          created_at: string
          enable_fallback: boolean
          evolution_token: string | null
          evolution_url: string | null
          id: string
          is_active: boolean
          n8n_webhook_url: string | null
          provider: string
          updated_at: string
          workspace_id: string
          zapi_client_token: string | null
          zapi_token: string | null
          zapi_url: string | null
        }
        Insert: {
          created_at?: string
          enable_fallback?: boolean
          evolution_token?: string | null
          evolution_url?: string | null
          id?: string
          is_active?: boolean
          n8n_webhook_url?: string | null
          provider: string
          updated_at?: string
          workspace_id: string
          zapi_client_token?: string | null
          zapi_token?: string | null
          zapi_url?: string | null
        }
        Update: {
          created_at?: string
          enable_fallback?: boolean
          evolution_token?: string | null
          evolution_url?: string | null
          id?: string
          is_active?: boolean
          n8n_webhook_url?: string | null
          provider?: string
          updated_at?: string
          workspace_id?: string
          zapi_client_token?: string | null
          zapi_token?: string | null
          zapi_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_providers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_providers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_business_hours: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_enabled: boolean
          start_time: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_enabled?: boolean
          start_time: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_enabled?: boolean
          start_time?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_business_hours_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_business_hours_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_configurations: {
        Row: {
          background_solid_color: string | null
          background_solid_enabled: boolean | null
          contrast_color: string | null
          created_at: string
          favicon_url: string | null
          id: string
          login_banner_url: string | null
          logo_claro: string | null
          logo_escuro: string | null
          logo_secundario_claro: string | null
          logo_secundario_escuro: string | null
          primary_color: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          background_solid_color?: string | null
          background_solid_enabled?: boolean | null
          contrast_color?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          login_banner_url?: string | null
          logo_claro?: string | null
          logo_escuro?: string | null
          logo_secundario_claro?: string | null
          logo_secundario_escuro?: string | null
          primary_color?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          background_solid_color?: string | null
          background_solid_enabled?: boolean | null
          contrast_color?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          login_banner_url?: string | null
          logo_claro?: string | null
          logo_escuro?: string | null
          logo_secundario_claro?: string | null
          logo_secundario_escuro?: string | null
          primary_color?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_configurations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_configurations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_contact_fields: {
        Row: {
          created_at: string
          field_name: string
          field_order: number
          id: string
          is_required: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          field_name: string
          field_order?: number
          id?: string
          is_required?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          field_name?: string
          field_order?: number
          id?: string
          is_required?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_contact_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_contact_fields_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_limits: {
        Row: {
          connection_limit: number
          created_at: string | null
          id: string
          updated_at: string | null
          user_limit: number
          workspace_id: string
        }
        Insert: {
          connection_limit?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_limit?: number
          workspace_id: string
        }
        Update: {
          connection_limit?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_limit?: number
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          is_hidden: boolean
          role: Database["public"]["Enums"]["system_profile"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          role?: Database["public"]["Enums"]["system_profile"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_hidden?: boolean
          role?: Database["public"]["Enums"]["system_profile"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "system_users_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspace_webhook_secrets: {
        Row: {
          created_at: string | null
          id: string
          secret_name: string
          updated_at: string | null
          webhook_url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          secret_name: string
          updated_at?: string | null
          webhook_url: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          secret_name?: string
          updated_at?: string | null
          webhook_url?: string
          workspace_id?: string
        }
        Relationships: []
      }
      workspace_webhook_settings: {
        Row: {
          created_at: string | null
          updated_at: string | null
          webhook_secret: string
          webhook_url: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          updated_at?: string | null
          webhook_secret: string
          webhook_url: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          updated_at?: string | null
          webhook_secret?: string
          webhook_url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_webhook_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_webhook_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces_view"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      workspaces: {
        Row: {
          cnpj: string | null
          created_at: string | null
          default_pipeline_id: string | null
          id: string
          is_active: boolean
          name: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          default_pipeline_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          default_pipeline_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_default_pipeline_id_fkey"
            columns: ["default_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      contacts_safe: {
        Row: {
          id: string | null
          name: string | null
          phone: string | null
          workspace_id: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
          phone?: string | null
          workspace_id?: never
        }
        Update: {
          id?: string | null
          name?: string | null
          phone?: string | null
          workspace_id?: never
        }
        Relationships: []
      }
      fact_activities_monthly_view: {
        Row: {
          activity_type: string | null
          completed_activities: number | null
          last_activity_at: string | null
          owner_user_id: string | null
          pending_activities: number | null
          period_start: string | null
          total_activities: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
      fact_deals_monthly_view: {
        Row: {
          column_id: string | null
          deals_count: number | null
          deals_value: number | null
          last_activity_at: string | null
          lost_value: number | null
          open_value: number | null
          owner_user_id: string | null
          period_start: string | null
          pipeline_id: string | null
          status: string | null
          won_value: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
      fact_leads_monthly_view: {
        Row: {
          archived_leads: number | null
          converted_leads: number | null
          last_activity_at: string | null
          owner_user_id: string | null
          period_start: string | null
          qualified_leads: number | null
          related_deals: number | null
          source: string | null
          status: string | null
          total_leads: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
      fact_products_monthly_view: {
        Row: {
          items_count: number | null
          last_item_at: string | null
          period_start: string | null
          product_id: string | null
          recurring_value: number | null
          total_quantity: number | null
          total_value: number | null
          workspace_id: string | null
        }
        Relationships: []
      }
      system_users_view: {
        Row: {
          avatar: string | null
          cargo_id: string | null
          cargo_ids: string[] | null
          created_at: string | null
          default_channel: string | null
          email: string | null
          id: string | null
          name: string | null
          profile: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      workspaces_view: {
        Row: {
          cnpj: string | null
          connections_count: number | null
          created_at: string | null
          name: string | null
          slug: string | null
          updated_at: string | null
          workspace_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      block_system_user: { Args: { user_email: string }; Returns: undefined }
      check_automation_permission:
        | {
            Args: { p_automation_id: string; p_permission: string }
            Returns: boolean
          }
        | {
            Args: {
              p_automation_id: string
              p_permission: string
              p_user_id?: string
            }
            Returns: boolean
          }
      check_column_permission: {
        Args: { p_column_id: string; p_permission: string }
        Returns: boolean
      }
      clear_all_conversations: { Args: never; Returns: undefined }
      create_column_automation:
        | {
            Args: {
              p_actions: Json
              p_column_id: string
              p_description: string
              p_name: string
              p_triggers: Json
              p_workspace_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_actions: Json
              p_column_id: string
              p_description: string
              p_name: string
              p_triggers: Json
              p_user_id?: string
              p_workspace_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_actions: Json
              p_column_id: string
              p_description: string
              p_ignore_business_hours?: boolean
              p_name: string
              p_triggers: Json
              p_user_id?: string
              p_workspace_id: string
            }
            Returns: string
          }
      create_connection_anon: {
        Args: {
          p_history_recovery: string
          p_instance_name: string
          p_metadata?: Json
        }
        Returns: string
      }
      create_system_user_with_password: {
        Args: {
          p_email: string
          p_name: string
          p_password: string
          p_profile?: string
          p_status?: string
        }
        Returns: string
      }
      current_system_user_id: { Args: never; Returns: string }
      debug_current_user: { Args: never; Returns: Json }
      debug_user_permissions: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      delete_column_automation:
        | { Args: { p_automation_id: string }; Returns: undefined }
        | {
            Args: { p_automation_id: string; p_user_id?: string }
            Returns: undefined
          }
      delete_connection_anon: {
        Args: { p_connection_id: string }
        Returns: undefined
      }
      delete_workspace_cascade: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      ensure_master_users_in_all_workspaces: { Args: never; Returns: undefined }
      fix_phone_numbers_from_remote_jid: {
        Args: never
        Returns: {
          action_taken: string
          contact_id: string
          new_phone: string
          old_phone: string
          workspace_id: string
        }[]
      }
      get_automation_details: {
        Args: { p_automation_id: string }
        Returns: Json
      }
      get_column_automations: {
        Args: { p_column_id: string }
        Returns: {
          column_id: string
          created_at: string
          description: string
          id: string
          ignore_business_hours: boolean
          is_active: boolean
          name: string
          updated_at: string
        }[]
      }
      get_contact_by_workspace_and_phone: {
        Args: { p_phone: string; p_workspace_id: string }
        Returns: {
          created_at: string
          email: string | null
          extra_info: Json | null
          id: string
          name: string
          phone: string | null
          profile_fetch_attempts: number | null
          profile_fetch_last_attempt: string | null
          profile_image_updated_at: string | null
          profile_image_url: string | null
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "contacts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_current_user_profile: { Args: never; Returns: string }
      get_system_user: {
        Args: { user_email: string; user_password: string }
        Returns: {
          avatar: string
          cargo_id: string
          email: string
          id: string
          name: string
          profile: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          role_name: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Returns: boolean
      }
      hash_password: { Args: { password: string }; Returns: string }
      invalidate_user_sessions: {
        Args: { p_except_token: string; p_user_id: string }
        Returns: number
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_current_user_master: { Args: never; Returns: boolean }
      is_master: { Args: never; Returns: boolean }
      is_member: {
        Args: {
          min_role?: Database["public"]["Enums"]["org_role"]
          org_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: {
          p_min_role?: Database["public"]["Enums"]["system_profile"]
          p_workspace_id: string
        }
        Returns: boolean
      }
      list_connections_anon: {
        Args: never
        Returns: {
          created_at: string
          history_recovery: string
          id: string
          instance_name: string
          last_activity_at: string
          metadata: Json
          phone_number: string
          qr_code: string
          status: string
          workspace_id: string
        }[]
      }
      move_pipeline_card: {
        Args: { p_card_id: string; p_new_column_id: string }
        Returns: {
          column_id: string
          contact_id: string
          id: string
          moved_to_column_at: string
          pipeline_id: string
          title: string
          updated_at: string
        }[]
      }
      set_current_user_context: {
        Args: { user_email?: string; user_id: string }
        Returns: undefined
      }
      slugify: { Args: { txt: string }; Returns: string }
      sync_user_roles: { Args: never; Returns: undefined }
      toggle_column_automation:
        | { Args: { p_automation_id: string }; Returns: boolean }
        | {
            Args: { p_automation_id: string; p_user_id?: string }
            Returns: boolean
          }
      trigger_time_based_automations: { Args: never; Returns: undefined }
      update_column_automation:
        | {
            Args: {
              p_actions: Json
              p_automation_id: string
              p_description: string
              p_name: string
              p_triggers: Json
            }
            Returns: undefined
          }
        | {
            Args: {
              p_actions: Json
              p_automation_id: string
              p_description: string
              p_name: string
              p_triggers: Json
              p_user_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_actions: Json
              p_automation_id: string
              p_description: string
              p_ignore_business_hours?: boolean
              p_name: string
              p_triggers: Json
              p_user_id?: string
            }
            Returns: undefined
          }
      update_connection_status_anon: {
        Args: {
          p_connection_id: string
          p_metadata?: Json
          p_phone_number?: string
          p_qr_code?: string
          p_status: string
        }
        Returns: undefined
      }
      update_fixed_phone_numbers: { Args: never; Returns: number }
      update_my_password: { Args: { new_password: string }; Returns: boolean }
      update_system_user_password: {
        Args: { p_new_password: string; p_user_id: string }
        Returns: boolean
      }
      update_user_password: {
        Args: { new_password: string; user_email: string }
        Returns: boolean
      }
      verify_password: {
        Args: { hash: string; password: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "master" | "user"
      conversation_status:
        | "active"
        | "open"
        | "closed"
        | "pending"
        | "em_atendimento"
      message_status: "sending" | "sent" | "delivered" | "read" | "failed"
      message_type:
        | "text"
        | "image"
        | "video"
        | "audio"
        | "document"
        | "sticker"
        | "location"
        | "reaction"
      org_role: "OWNER" | "ADMIN" | "USER"
      sender_type: "contact" | "agent" | "ia" | "system" | "user"
      system_profile: "master" | "admin" | "user"
      workspace_role: "mentor_master" | "gestor" | "colaborador"
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
      app_role: ["admin", "master", "user"],
      conversation_status: [
        "active",
        "open",
        "closed",
        "pending",
        "em_atendimento",
      ],
      message_status: ["sending", "sent", "delivered", "read", "failed"],
      message_type: [
        "text",
        "image",
        "video",
        "audio",
        "document",
        "sticker",
        "location",
        "reaction",
      ],
      org_role: ["OWNER", "ADMIN", "USER"],
      sender_type: ["contact", "agent", "ia", "system", "user"],
      system_profile: ["master", "admin", "user"],
      workspace_role: ["mentor_master", "gestor", "colaborador"],
    },
  },
} as const
