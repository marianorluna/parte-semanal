CREATE TYPE "public"."estado_ausencia" AS ENUM('SOLICITADA', 'APROBADA', 'RECHAZADA', 'ANULADA');--> statement-breakpoint
CREATE TABLE "ausencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"tipo_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"minutos" integer,
	"estado" "estado_ausencia" DEFAULT 'SOLICITADA' NOT NULL,
	"motivo_solicitud" text,
	"motivo_resolucion" text,
	"resuelto_por" uuid,
	"resuelto_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ausencia_rango_ck" CHECK ("ausencia"."desde" <= "ausencia"."hasta"),
	CONSTRAINT "ausencia_minutos_ck" CHECK ("ausencia"."minutos" is null or ("ausencia"."minutos" > 0 and "ausencia"."minutos" <= 1440))
);
--> statement-breakpoint
CREATE TABLE "saldo_vacaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empleado_id" uuid NOT NULL,
	"anio" integer NOT NULL,
	"minutos_asignados" integer NOT NULL,
	"minutos_arrastrados" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saldo_vacaciones_minutos_ck" CHECK ("saldo_vacaciones"."minutos_asignados" >= 0 and "saldo_vacaciones"."minutos_arrastrados" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tipo_ausencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"computa_saldo" boolean DEFAULT false NOT NULL,
	"requiere_aprobacion" boolean DEFAULT true NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_tipo_id_tipo_ausencia_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."tipo_ausencia"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ausencia" ADD CONSTRAINT "ausencia_resuelto_por_usuario_id_fk" FOREIGN KEY ("resuelto_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saldo_vacaciones" ADD CONSTRAINT "saldo_vacaciones_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tipo_ausencia" ADD CONSTRAINT "tipo_ausencia_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ausencia_empleado_fechas_idx" ON "ausencia" USING btree ("empleado_id","desde");--> statement-breakpoint
CREATE INDEX "ausencia_empresa_estado_idx" ON "ausencia" USING btree ("empresa_id","estado");--> statement-breakpoint
CREATE UNIQUE INDEX "saldo_vacaciones_empleado_anio_uq" ON "saldo_vacaciones" USING btree ("empleado_id","anio");--> statement-breakpoint
CREATE UNIQUE INDEX "tipo_ausencia_empresa_codigo_uq" ON "tipo_ausencia" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE INDEX "tipo_ausencia_empresa_idx" ON "tipo_ausencia" USING btree ("empresa_id");