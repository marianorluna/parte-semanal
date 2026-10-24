CREATE TYPE "public"."tipo_periodo" AS ENUM('SEMANAL', 'MENSUAL');--> statement-breakpoint
CREATE TABLE "periodo_cerrado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo" "tipo_periodo" NOT NULL,
	"empleado_id" uuid,
	"iso_year" integer,
	"iso_week" integer,
	"anio" integer NOT NULL,
	"mes" integer,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"motivo" text,
	"partes_bloqueados" integer DEFAULT 0 NOT NULL,
	"cerrado_por" uuid,
	"reabierto_por" uuid,
	"reabierto_at" timestamp with time zone,
	"motivo_reapertura" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periodo_cerrado_rango_ck" CHECK ("periodo_cerrado"."desde" <= "periodo_cerrado"."hasta"),
	CONSTRAINT "periodo_cerrado_mes_ck" CHECK ("periodo_cerrado"."mes" is null or ("periodo_cerrado"."mes" between 1 and 12)),
	CONSTRAINT "periodo_cerrado_semana_ck" CHECK ("periodo_cerrado"."iso_week" is null or ("periodo_cerrado"."iso_week" between 1 and 53))
);
--> statement-breakpoint
ALTER TABLE "periodo_cerrado" ADD CONSTRAINT "periodo_cerrado_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodo_cerrado" ADD CONSTRAINT "periodo_cerrado_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodo_cerrado" ADD CONSTRAINT "periodo_cerrado_cerrado_por_usuario_id_fk" FOREIGN KEY ("cerrado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periodo_cerrado" ADD CONSTRAINT "periodo_cerrado_reabierto_por_usuario_id_fk" FOREIGN KEY ("reabierto_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "periodo_cerrado_empresa_rango_idx" ON "periodo_cerrado" USING btree ("empresa_id","desde","hasta");--> statement-breakpoint
CREATE INDEX "periodo_cerrado_empleado_idx" ON "periodo_cerrado" USING btree ("empleado_id");