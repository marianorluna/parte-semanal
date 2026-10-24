CREATE TYPE "public"."tipo_notificacion" AS ENUM('RECORDATORIO_PARTE', 'EQUIPO_PENDIENTE', 'RIESGO_PROYECTO');--> statement-breakpoint
CREATE TABLE "notificacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" "tipo_notificacion" NOT NULL,
	"titulo" text NOT NULL,
	"cuerpo" text NOT NULL,
	"url" text,
	"clave_idempotencia" text NOT NULL,
	"metadata" jsonb,
	"leida_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proyecto" ADD COLUMN "fecha_inicio" date;--> statement-breakpoint
ALTER TABLE "proyecto" ADD COLUMN "fecha_fin" date;--> statement-breakpoint
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notificacion_usuario_clave_uq" ON "notificacion" USING btree ("usuario_id","clave_idempotencia");--> statement-breakpoint
CREATE INDEX "notificacion_usuario_leida_idx" ON "notificacion" USING btree ("usuario_id","leida_at");--> statement-breakpoint
CREATE INDEX "notificacion_empresa_created_idx" ON "notificacion" USING btree ("empresa_id","created_at");--> statement-breakpoint
CREATE INDEX "parte_empresa_semana_idx" ON "parte" USING btree ("empresa_id","iso_year","iso_week");--> statement-breakpoint
CREATE INDEX "proyecto_empresa_activo_idx" ON "proyecto" USING btree ("empresa_id","activo");--> statement-breakpoint
CREATE INDEX "usuario_empleado_idx" ON "usuario" USING btree ("empleado_id");--> statement-breakpoint
ALTER TABLE "proyecto" ADD CONSTRAINT "proyecto_plazo_ck" CHECK ("proyecto"."fecha_fin" is null or ("proyecto"."fecha_inicio" is not null and "proyecto"."fecha_inicio" <= "proyecto"."fecha_fin"));