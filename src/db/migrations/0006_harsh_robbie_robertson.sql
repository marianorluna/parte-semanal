CREATE TYPE "public"."estado_informe" AS ENUM('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'FALLIDO');--> statement-breakpoint
CREATE TYPE "public"."formato_informe" AS ENUM('CSV', 'XLSX', 'PDF');--> statement-breakpoint
CREATE TYPE "public"."tipo_informe" AS ENUM('CERTIFICACION_MENSUAL', 'LIBRO_JORNADA', 'COSTES_PROYECTO', 'AUSENCIAS', 'HORAS_EXTRA', 'AUDITORIA');--> statement-breakpoint
CREATE TABLE "informe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"solicitante_id" uuid,
	"tipo" "tipo_informe" NOT NULL,
	"formato" "formato_informe" NOT NULL,
	"parametros" jsonb NOT NULL,
	"estado" "estado_informe" DEFAULT 'PENDIENTE' NOT NULL,
	"nombre_archivo" text,
	"contenido" "bytea",
	"tamano_bytes" integer,
	"error" text,
	"job_id" text,
	"completado_at" timestamp with time zone,
	"expira_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "informe_tamano_ck" CHECK ("informe"."tamano_bytes" is null or "informe"."tamano_bytes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "informe" ADD CONSTRAINT "informe_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "informe" ADD CONSTRAINT "informe_solicitante_id_usuario_id_fk" FOREIGN KEY ("solicitante_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "informe_empresa_created_idx" ON "informe" USING btree ("empresa_id","created_at");--> statement-breakpoint
CREATE INDEX "informe_empresa_estado_idx" ON "informe" USING btree ("empresa_id","estado");