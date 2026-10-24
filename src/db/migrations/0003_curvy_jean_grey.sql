CREATE TYPE "public"."aplica_en" AS ENUM('TODO', 'LABORABLE', 'FESTIVO');--> statement-breakpoint
CREATE TYPE "public"."tipo_hora" AS ENUM('NORMAL', 'EXTRA', 'COMPLEMENTARIA', 'FESTIVA', 'VIAJE', 'FORMACION', 'PARALIZACION');--> statement-breakpoint
CREATE TABLE "convenio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empleado_convenio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empleado_id" uuid NOT NULL,
	"convenio_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empleado_convenio_rango_ck" CHECK ("empleado_convenio"."hasta" is null or "empleado_convenio"."desde" <= "empleado_convenio"."hasta")
);
--> statement-breakpoint
CREATE TABLE "regla_computo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"convenio_id" uuid NOT NULL,
	"tipo_hora" "tipo_hora" NOT NULL,
	"factor_bps" integer DEFAULT 10000 NOT NULL,
	"aplica_en" "aplica_en" DEFAULT 'TODO' NOT NULL,
	"tope_diario_min" integer,
	"tope_semanal_min" integer,
	"requiere_autorizacion" boolean DEFAULT false NOT NULL,
	"prioridad" integer DEFAULT 100 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regla_computo_factor_ck" CHECK ("regla_computo"."factor_bps" between 0 and 100000),
	CONSTRAINT "regla_computo_topes_ck" CHECK (("regla_computo"."tope_diario_min" is null or "regla_computo"."tope_diario_min" > 0) and ("regla_computo"."tope_semanal_min" is null or "regla_computo"."tope_semanal_min" > 0))
);
--> statement-breakpoint
CREATE TABLE "resultado_computo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parte_id" uuid NOT NULL,
	"imputacion_id" uuid NOT NULL,
	"tramo" integer DEFAULT 0 NOT NULL,
	"tipo_hora" "tipo_hora" NOT NULL,
	"minutos_base" integer NOT NULL,
	"factor_bps" integer NOT NULL,
	"minutos_computados" integer NOT NULL,
	"requiere_autorizacion" boolean DEFAULT false NOT NULL,
	"regla_id" uuid,
	"convenio_id" uuid,
	"convenio_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resultado_computo_minutos_ck" CHECK ("resultado_computo"."minutos_base" > 0 and "resultado_computo"."minutos_computados" >= 0 and "resultado_computo"."tramo" >= 0)
);
--> statement-breakpoint
ALTER TABLE "convenio" ADD CONSTRAINT "convenio_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleado_convenio" ADD CONSTRAINT "empleado_convenio_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleado_convenio" ADD CONSTRAINT "empleado_convenio_convenio_id_convenio_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenio"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regla_computo" ADD CONSTRAINT "regla_computo_convenio_id_convenio_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenio"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultado_computo" ADD CONSTRAINT "resultado_computo_parte_id_parte_id_fk" FOREIGN KEY ("parte_id") REFERENCES "public"."parte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultado_computo" ADD CONSTRAINT "resultado_computo_imputacion_id_imputacion_id_fk" FOREIGN KEY ("imputacion_id") REFERENCES "public"."imputacion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultado_computo" ADD CONSTRAINT "resultado_computo_regla_id_regla_computo_id_fk" FOREIGN KEY ("regla_id") REFERENCES "public"."regla_computo"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultado_computo" ADD CONSTRAINT "resultado_computo_convenio_id_convenio_id_fk" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenio"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "convenio_empresa_codigo_uq" ON "convenio" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE INDEX "convenio_empresa_idx" ON "convenio" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "empleado_convenio_empleado_idx" ON "empleado_convenio" USING btree ("empleado_id","desde");--> statement-breakpoint
CREATE UNIQUE INDEX "regla_computo_convenio_tipo_uq" ON "regla_computo" USING btree ("convenio_id","tipo_hora");--> statement-breakpoint
CREATE UNIQUE INDEX "resultado_computo_imputacion_tramo_uq" ON "resultado_computo" USING btree ("imputacion_id","tramo");--> statement-breakpoint
CREATE INDEX "resultado_computo_parte_idx" ON "resultado_computo" USING btree ("parte_id");