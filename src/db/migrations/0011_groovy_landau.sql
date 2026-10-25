ALTER TABLE "parte" ADD COLUMN "capacidad_min" integer;--> statement-breakpoint
ALTER TABLE "parte" ADD COLUMN "desviacion_min" integer;--> statement-breakpoint
ALTER TABLE "parte" ADD COLUMN "motivo_desviacion" text;--> statement-breakpoint
ALTER TABLE "proyecto" ADD COLUMN "es_ajuste" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "proyecto_ajuste_empresa_uq" ON "proyecto" USING btree ("empresa_id") WHERE "proyecto"."es_ajuste";--> statement-breakpoint
ALTER TABLE "parte" ADD CONSTRAINT "parte_desviacion_ck" CHECK (("parte"."motivo_desviacion" is null or "parte"."capacidad_min" is not null) and ("parte"."capacidad_min" is null or "parte"."capacidad_min" >= 0));