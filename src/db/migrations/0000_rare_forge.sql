CREATE TYPE "public"."estado_parte" AS ENUM('BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('TRABAJADOR', 'ENCARGADO', 'ADMIN');--> statement-breakpoint
CREATE TABLE "asignacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empleado_id" uuid NOT NULL,
	"tarea_id" uuid NOT NULL,
	"desde" date NOT NULL,
	"hasta" date,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asignacion_rango_ck" CHECK ("asignacion"."hasta" is null or "asignacion"."desde" <= "asignacion"."hasta")
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"entidad" text NOT NULL,
	"entidad_id" text,
	"accion" text NOT NULL,
	"antes" jsonb,
	"despues" jsonb,
	"motivo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empleado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"categoria" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empleado_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "empresa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"cif" text,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresa_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "imputacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parte_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"tarea_id" uuid NOT NULL,
	"minutos" integer NOT NULL,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imputacion_minutos_ck" CHECK ("imputacion"."minutos" > 0 and "imputacion"."minutos" <= 1440)
);
--> statement-breakpoint
CREATE TABLE "parte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"iso_year" integer NOT NULL,
	"iso_week" integer NOT NULL,
	"week_start" date NOT NULL,
	"estado" "estado_parte" DEFAULT 'BORRADOR' NOT NULL,
	"total_minutos" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"enviado_at" timestamp with time zone,
	"revisado_por" uuid,
	"revisado_at" timestamp with time zone,
	"motivo_rechazo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parte_semana_ck" CHECK ("parte"."iso_week" between 1 and 53),
	CONSTRAINT "parte_total_ck" CHECK ("parte"."total_minutos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "proyecto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"horas_presupuesto" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proyecto_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "tarea" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"horas_presupuesto" integer,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"nombre" text NOT NULL,
	"rol" "rol" DEFAULT 'TRABAJADOR' NOT NULL,
	"empleado_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "usuario_proyecto" (
	"usuario_id" uuid NOT NULL,
	"proyecto_id" uuid NOT NULL,
	CONSTRAINT "usuario_proyecto_usuario_id_proyecto_id_pk" PRIMARY KEY("usuario_id","proyecto_id")
);
--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_tarea_id_tarea_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tarea"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_id_usuario_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleado" ADD CONSTRAINT "empleado_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imputacion" ADD CONSTRAINT "imputacion_parte_id_parte_id_fk" FOREIGN KEY ("parte_id") REFERENCES "public"."parte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imputacion" ADD CONSTRAINT "imputacion_tarea_id_tarea_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tarea"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parte" ADD CONSTRAINT "parte_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parte" ADD CONSTRAINT "parte_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parte" ADD CONSTRAINT "parte_revisado_por_usuario_id_fk" FOREIGN KEY ("revisado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proyecto" ADD CONSTRAINT "proyecto_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_proyecto_id_proyecto_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyecto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario_proyecto" ADD CONSTRAINT "usuario_proyecto_proyecto_id_proyecto_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyecto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asignacion_empleado_tarea_desde_uq" ON "asignacion" USING btree ("empleado_id","tarea_id","desde");--> statement-breakpoint
CREATE INDEX "asignacion_empleado_idx" ON "asignacion" USING btree ("empleado_id");--> statement-breakpoint
CREATE INDEX "auditoria_created_idx" ON "auditoria" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auditoria_entidad_idx" ON "auditoria" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "empleado_empresa_idx" ON "empleado" USING btree ("empresa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "imputacion_parte_fecha_tarea_uq" ON "imputacion" USING btree ("parte_id","fecha","tarea_id");--> statement-breakpoint
CREATE INDEX "imputacion_parte_idx" ON "imputacion" USING btree ("parte_id");--> statement-breakpoint
CREATE INDEX "imputacion_tarea_fecha_idx" ON "imputacion" USING btree ("tarea_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "parte_empleado_semana_uq" ON "parte" USING btree ("empleado_id","iso_year","iso_week");--> statement-breakpoint
CREATE INDEX "parte_estado_semana_idx" ON "parte" USING btree ("estado","iso_year","iso_week");--> statement-breakpoint
CREATE INDEX "proyecto_empresa_idx" ON "proyecto" USING btree ("empresa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tarea_proyecto_codigo_uq" ON "tarea" USING btree ("proyecto_id","codigo");--> statement-breakpoint
CREATE INDEX "usuario_empresa_idx" ON "usuario" USING btree ("empresa_id");