CREATE TYPE "public"."estado_email" AS ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO', 'SIN_PROVEEDOR');--> statement-breakpoint
CREATE TABLE "email_envio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" "tipo_notificacion" NOT NULL,
	"destinatario" text NOT NULL,
	"asunto" text NOT NULL,
	"cuerpo" text NOT NULL,
	"plantilla" text NOT NULL,
	"plantilla_version" integer DEFAULT 1 NOT NULL,
	"estado" "estado_email" DEFAULT 'PENDIENTE' NOT NULL,
	"clave_idempotencia" text NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"ultimo_error" text,
	"enviado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_envio_intentos_ck" CHECK ("email_envio"."intentos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "preferencia_aviso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" "tipo_notificacion" NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_envio" ADD CONSTRAINT "email_envio_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_envio" ADD CONSTRAINT "email_envio_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferencia_aviso" ADD CONSTRAINT "preferencia_aviso_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_envio_usuario_clave_uq" ON "email_envio" USING btree ("usuario_id","clave_idempotencia");--> statement-breakpoint
CREATE INDEX "email_envio_empresa_created_idx" ON "email_envio" USING btree ("empresa_id","created_at");--> statement-breakpoint
CREATE INDEX "email_envio_estado_idx" ON "email_envio" USING btree ("estado");--> statement-breakpoint
CREATE UNIQUE INDEX "preferencia_aviso_usuario_tipo_uq" ON "preferencia_aviso" USING btree ("usuario_id","tipo");