CREATE TYPE "public"."ambito_calendario" AS ENUM('NACIONAL', 'CCAA', 'PROVINCIA', 'LOCAL', 'EMPRESA');--> statement-breakpoint
CREATE TYPE "public"."origen_festivo" AS ENUM('SEED', 'ADMIN', 'IMPORTACION');--> statement-breakpoint
CREATE TABLE "calendario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"ambito" "ambito_calendario" DEFAULT 'EMPRESA' NOT NULL,
	"codigo" text NOT NULL,
	"comunidad" text,
	"dias_semana" integer[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"horas_diarias_min" integer,
	"vigente_desde" date NOT NULL,
	"vigente_hasta" date,
	"es_predeterminado" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendario_vigencia_ck" CHECK ("calendario"."vigente_hasta" is null or "calendario"."vigente_desde" <= "calendario"."vigente_hasta"),
	CONSTRAINT "calendario_jornada_ck" CHECK ("calendario"."horas_diarias_min" is null or ("calendario"."horas_diarias_min" > 0 and "calendario"."horas_diarias_min" <= 1440)),
	CONSTRAINT "calendario_dias_ck" CHECK ("calendario"."dias_semana" <@ '{1,2,3,4,5,6,7}'::integer[])
);
--> statement-breakpoint
CREATE TABLE "empleado_calendario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empleado_id" uuid NOT NULL,
	"calendario_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empleado_calendario_rango_ck" CHECK ("empleado_calendario"."hasta" is null or "empleado_calendario"."desde" <= "empleado_calendario"."hasta")
);
--> statement-breakpoint
CREATE TABLE "excepcion_calendario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendario_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"laborable" boolean NOT NULL,
	"motivo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "festivo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendario_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"nombre" text NOT NULL,
	"ambito" "ambito_calendario" DEFAULT 'EMPRESA' NOT NULL,
	"es_laborable" boolean DEFAULT false NOT NULL,
	"origen" "origen_festivo" DEFAULT 'ADMIN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jornada_teorica" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendario_id" uuid NOT NULL,
	"empleado_id" uuid,
	"desde" date NOT NULL,
	"hasta" date,
	"horas_semanales_min" integer NOT NULL,
	"horas_diarias_min" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jornada_teorica_rango_ck" CHECK ("jornada_teorica"."hasta" is null or "jornada_teorica"."desde" <= "jornada_teorica"."hasta"),
	CONSTRAINT "jornada_teorica_minutos_ck" CHECK ("jornada_teorica"."horas_semanales_min" > 0 and ("jornada_teorica"."horas_diarias_min" is null or "jornada_teorica"."horas_diarias_min" > 0))
);
--> statement-breakpoint
ALTER TABLE "parte" ADD COLUMN "calendario_id" uuid;--> statement-breakpoint
ALTER TABLE "parte" ADD COLUMN "calendario_version" integer;--> statement-breakpoint
ALTER TABLE "calendario" ADD CONSTRAINT "calendario_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleado_calendario" ADD CONSTRAINT "empleado_calendario_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleado_calendario" ADD CONSTRAINT "empleado_calendario_calendario_id_calendario_id_fk" FOREIGN KEY ("calendario_id") REFERENCES "public"."calendario"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excepcion_calendario" ADD CONSTRAINT "excepcion_calendario_calendario_id_calendario_id_fk" FOREIGN KEY ("calendario_id") REFERENCES "public"."calendario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "festivo" ADD CONSTRAINT "festivo_calendario_id_calendario_id_fk" FOREIGN KEY ("calendario_id") REFERENCES "public"."calendario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jornada_teorica" ADD CONSTRAINT "jornada_teorica_calendario_id_calendario_id_fk" FOREIGN KEY ("calendario_id") REFERENCES "public"."calendario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jornada_teorica" ADD CONSTRAINT "jornada_teorica_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "calendario_empresa_codigo_uq" ON "calendario" USING btree ("empresa_id","codigo");--> statement-breakpoint
CREATE INDEX "calendario_empresa_idx" ON "calendario" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "empleado_calendario_empleado_idx" ON "empleado_calendario" USING btree ("empleado_id","desde");--> statement-breakpoint
CREATE UNIQUE INDEX "excepcion_calendario_fecha_uq" ON "excepcion_calendario" USING btree ("calendario_id","fecha");--> statement-breakpoint
CREATE INDEX "excepcion_calendario_idx" ON "excepcion_calendario" USING btree ("calendario_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "festivo_calendario_fecha_uq" ON "festivo" USING btree ("calendario_id","fecha");--> statement-breakpoint
CREATE INDEX "festivo_calendario_idx" ON "festivo" USING btree ("calendario_id","fecha");--> statement-breakpoint
CREATE INDEX "jornada_teorica_calendario_idx" ON "jornada_teorica" USING btree ("calendario_id","desde");--> statement-breakpoint
CREATE INDEX "jornada_teorica_empleado_idx" ON "jornada_teorica" USING btree ("empleado_id","desde");--> statement-breakpoint
ALTER TABLE "parte" ADD CONSTRAINT "parte_calendario_id_calendario_id_fk" FOREIGN KEY ("calendario_id") REFERENCES "public"."calendario"("id") ON DELETE set null ON UPDATE no action;