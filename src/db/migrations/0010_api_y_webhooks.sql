CREATE TYPE "public"."estado_entrega" AS ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO', 'AGOTADO');--> statement-breakpoint
CREATE TABLE "api_idempotencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid NOT NULL,
	"clave" text NOT NULL,
	"metodo" text NOT NULL,
	"ruta" text NOT NULL,
	"respuesta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"prefijo" text NOT NULL,
	"hash" text NOT NULL,
	"alcances" text[] DEFAULT '{}'::text[] NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"caduca_at" timestamp with time zone,
	"ultimo_uso_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_prefijo_ck" CHECK (length("api_key"."prefijo") >= 6)
);
--> statement-breakpoint
CREATE TABLE "api_rate_limit" (
	"api_key_id" uuid NOT NULL,
	"ventana" timestamp with time zone NOT NULL,
	"contador" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_rate_limit_api_key_id_ventana_pk" PRIMARY KEY("api_key_id","ventana"),
	CONSTRAINT "api_rate_limit_contador_ck" CHECK ("api_rate_limit"."contador" >= 0)
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"agregado" text NOT NULL,
	"agregado_id" uuid NOT NULL,
	"evento" text NOT NULL,
	"payload" jsonb NOT NULL,
	"procesado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"url" text NOT NULL,
	"secreto" text NOT NULL,
	"eventos" text[] DEFAULT '{}'::text[] NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_entrega" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"outbox_id" uuid,
	"evento" text NOT NULL,
	"payload" jsonb NOT NULL,
	"estado" "estado_entrega" DEFAULT 'PENDIENTE' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"ultimo_error" text,
	"proximo_intento_at" timestamp with time zone,
	"enviado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_entrega_intentos_ck" CHECK ("webhook_entrega"."intentos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "api_idempotencia" ADD CONSTRAINT "api_idempotencia_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_rate_limit" ADD CONSTRAINT "api_rate_limit_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_entrega" ADD CONSTRAINT "webhook_entrega_webhook_id_webhook_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_entrega" ADD CONSTRAINT "webhook_entrega_outbox_id_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."outbox"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_idempotencia_clave_uq" ON "api_idempotencia" USING btree ("api_key_id","clave");--> statement-breakpoint
CREATE INDEX "api_idempotencia_created_idx" ON "api_idempotencia" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "api_key_prefijo_uq" ON "api_key" USING btree ("prefijo");--> statement-breakpoint
CREATE INDEX "api_key_empresa_idx" ON "api_key" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "outbox_pendiente_idx" ON "outbox" USING btree ("procesado_at","created_at");--> statement-breakpoint
CREATE INDEX "outbox_empresa_idx" ON "outbox" USING btree ("empresa_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_empresa_idx" ON "webhook" USING btree ("empresa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_entrega_outbox_uq" ON "webhook_entrega" USING btree ("webhook_id","outbox_id");--> statement-breakpoint
CREATE INDEX "webhook_entrega_estado_idx" ON "webhook_entrega" USING btree ("estado","proximo_intento_at");--> statement-breakpoint
CREATE INDEX "webhook_entrega_webhook_idx" ON "webhook_entrega" USING btree ("webhook_id","created_at");