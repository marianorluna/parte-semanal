CREATE TABLE "coste_hora" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"empleado_id" uuid,
	"categoria" text,
	"importe_hora_cents" integer NOT NULL,
	"desde" date NOT NULL,
	"hasta" date,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coste_hora_importe_ck" CHECK ("coste_hora"."importe_hora_cents" >= 0),
	CONSTRAINT "coste_hora_ambito_ck" CHECK ("coste_hora"."empleado_id" is not null or ("coste_hora"."categoria" is not null and length(trim("coste_hora"."categoria")) > 0)),
	CONSTRAINT "coste_hora_vigencia_ck" CHECK ("coste_hora"."hasta" is null or "coste_hora"."desde" <= "coste_hora"."hasta")
);
--> statement-breakpoint
CREATE TABLE "coste_imputacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parte_id" uuid NOT NULL,
	"imputacion_id" uuid NOT NULL,
	"empleado_id" uuid NOT NULL,
	"tarea_id" uuid NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"minutos" integer NOT NULL,
	"coste_hora_cents" integer,
	"importe_cents" integer NOT NULL,
	"sin_tarifa" boolean DEFAULT false NOT NULL,
	"tarifa_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coste_imputacion_importe_ck" CHECK ("coste_imputacion"."minutos" > 0 and "coste_imputacion"."importe_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "presupuesto_proyecto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proyecto_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"importe_cents" integer NOT NULL,
	"horas_presupuesto" integer,
	"motivo" text,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presupuesto_proyecto_importe_ck" CHECK ("presupuesto_proyecto"."importe_cents" >= 0),
	CONSTRAINT "presupuesto_proyecto_version_ck" CHECK ("presupuesto_proyecto"."version" > 0),
	CONSTRAINT "presupuesto_proyecto_horas_ck" CHECK ("presupuesto_proyecto"."horas_presupuesto" is null or "presupuesto_proyecto"."horas_presupuesto" >= 0)
);
--> statement-breakpoint
ALTER TABLE "coste_hora" ADD CONSTRAINT "coste_hora_empresa_id_empresa_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coste_hora" ADD CONSTRAINT "coste_hora_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coste_imputacion" ADD CONSTRAINT "coste_imputacion_parte_id_parte_id_fk" FOREIGN KEY ("parte_id") REFERENCES "public"."parte"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coste_imputacion" ADD CONSTRAINT "coste_imputacion_imputacion_id_imputacion_id_fk" FOREIGN KEY ("imputacion_id") REFERENCES "public"."imputacion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coste_imputacion" ADD CONSTRAINT "coste_imputacion_empleado_id_empleado_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleado"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coste_imputacion" ADD CONSTRAINT "coste_imputacion_tarea_id_tarea_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tarea"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coste_imputacion" ADD CONSTRAINT "coste_imputacion_proyecto_id_proyecto_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyecto"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coste_imputacion" ADD CONSTRAINT "coste_imputacion_tarifa_id_coste_hora_id_fk" FOREIGN KEY ("tarifa_id") REFERENCES "public"."coste_hora"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto_proyecto" ADD CONSTRAINT "presupuesto_proyecto_proyecto_id_proyecto_id_fk" FOREIGN KEY ("proyecto_id") REFERENCES "public"."proyecto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto_proyecto" ADD CONSTRAINT "presupuesto_proyecto_creado_por_usuario_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuario"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coste_hora_empresa_empleado_idx" ON "coste_hora" USING btree ("empresa_id","empleado_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coste_imputacion_imputacion_uq" ON "coste_imputacion" USING btree ("imputacion_id");--> statement-breakpoint
CREATE INDEX "coste_imputacion_parte_idx" ON "coste_imputacion" USING btree ("parte_id");--> statement-breakpoint
CREATE INDEX "coste_imputacion_proyecto_fecha_idx" ON "coste_imputacion" USING btree ("proyecto_id","fecha");--> statement-breakpoint
CREATE INDEX "coste_imputacion_empleado_fecha_idx" ON "coste_imputacion" USING btree ("empleado_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "presupuesto_proyecto_version_uq" ON "presupuesto_proyecto" USING btree ("proyecto_id","version");--> statement-breakpoint
CREATE INDEX "presupuesto_proyecto_idx" ON "presupuesto_proyecto" USING btree ("proyecto_id");