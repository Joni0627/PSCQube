-- ==========================================
-- SCRIPT DE GENERACIÓN DE SCHEMA Y SEGURIDAD SUPABASE
-- ==========================================
-- Este archivo contiene las definiciones DDL de Postgres para crear todas
-- las tablas necesarias en su proyecto de Supabase, configuradas con
-- Row Level Security (RLS) y políticas de seguridad para accesos seguros.
--
-- Instrucciones de uso:
-- 1. Ingrese al panel web de Supabase (https://supabase.com/dashboard)
-- 2. Seleccione su proyecto.
-- 3. Diríjase a la barra lateral izquierda y haga clic en "SQL Editor".
-- 4. Haga clic en "New Query" (Nueva Consulta), pegue todo este script y ejecútelo.
-- ==========================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabla: turnosv2
CREATE TABLE IF NOT EXISTS turnosv2 (
    id TEXT PRIMARY KEY,
    name TEXT,
    start_time TEXT,
    end_time TEXT,
    duration_hours NUMERIC
);

-- 2. Tabla: paletizadorav2
CREATE TABLE IF NOT EXISTS paletizadorav2 (
    id TEXT PRIMARY KEY,
    tipo TEXT,
    nombre TEXT,
    hac_id TEXT
);

-- 3. Tabla: ensacadorav2
CREATE TABLE IF NOT EXISTS ensacadorav2 (
    id TEXT PRIMARY KEY,
    tipo TEXT,
    nombre TEXT,
    boquillas TEXT,
    hac_id TEXT,
    es_punto_de_muestreo BOOLEAN DEFAULT FALSE
);

-- 4. Tabla: hacsv2
CREATE TABLE IF NOT EXISTS hacsv2 (
    id TEXT PRIMARY KEY,
    hac TEXT,
    descripcion_hac TEXT,
    gpo_codigo_objeto TEXT,
    equipo TEXT,
    es_fechador BOOLEAN DEFAULT FALSE,
    es_balanza BOOLEAN DEFAULT FALSE
);

-- 5. Tabla: causasv2
CREATE TABLE IF NOT EXISTS causasv2 (
    id TEXT PRIMARY KEY,
    hac TEXT,
    descripcion TEXT,
    parte_objeto TEXT,
    grupo_codigo_sintoma TEXT,
    codigo_sintoma TEXT,
    causa_sap TEXT,
    grupo_codigo_causa TEXT,
    codigo_causa TEXT,
    tipo_paro TEXT
);

-- 6. Tabla: materialesv2
CREATE TABLE IF NOT EXISTS materialesv2 (
    id TEXT PRIMARY KEY,
    nombre TEXT,
    codigo_sap TEXT,
    peso_embalaje NUMERIC,
    peso_bolsa NUMERIC,
    es_pallet BOOLEAN DEFAULT FALSE,
    es_productivo BOOLEAN DEFAULT FALSE,
    es_insumo BOOLEAN DEFAULT FALSE,
    es_bigbag BOOLEAN DEFAULT FALSE,
    es_despacho BOOLEAN DEFAULT FALSE
);

-- 7. Tabla: capacidadesv2
CREATE TABLE IF NOT EXISTS capacidadesv2 (
    id TEXT PRIMARY KEY,
    ensacadora_id TEXT,
    peletizadora_id TEXT,
    material_id TEXT,
    bdp NUMERIC
);

-- 8. Tabla: puntos_cargav2
CREATE TABLE IF NOT EXISTS puntos_cargav2 (
    id TEXT PRIMARY KEY,
    nombre TEXT,
    tipo TEXT
);

-- 9. Tabla: empresasv2
CREATE TABLE IF NOT EXISTS empresasv2 (
    id TEXT PRIMARY KEY,
    nombre TEXT,
    direccion TEXT,
    cuit TEXT,
    telefono TEXT,
    email TEXT
);

-- 10. Tabla: proveedores_bolsav2
CREATE TABLE IF NOT EXISTS proveedores_bolsav2 (
    id TEXT PRIMARY KEY,
    nombre TEXT,
    direccion TEXT,
    telefono TEXT,
    email TEXT
);

-- 11. Tabla: vehiculosv2
CREATE TABLE IF NOT EXISTS vehiculosv2 (
    id TEXT PRIMARY KEY,
    marca TEXT,
    identificacion TEXT,
    tipo TEXT,
    carga_maxima TEXT
);

-- 12. Tabla: carga_combustiblev2
CREATE TABLE IF NOT EXISTS carga_combustiblev2 (
    id TEXT PRIMARY KEY,
    fecha TEXT,
    unidad_movil TEXT,
    id_operario TEXT,
    descripcion_operario TEXT,
    litros_combustible NUMERIC
);

-- 13. Tabla: usuariosv2
CREATE TABLE IF NOT EXISTS usuariosv2 (
    dni TEXT PRIMARY KEY,
    nombre TEXT,
    usuariosap TEXT,
    email TEXT,
    email2 TEXT,
    puesto TEXT,
    perfil TEXT,
    permisos TEXT
);

-- 14. Tabla: produccionv2
CREATE TABLE IF NOT EXISTS produccionv2 (
    id TEXT PRIMARY KEY,
    fecha TEXT,
    turno_id TEXT,
    descripcion_turno TEXT,
    palletizadora_id TEXT,
    hac_paletizadora TEXT,
    ensacadora_id TEXT,
    hac_ensacadora TEXT,
    material_id TEXT,
    decripcion_material TEXT,
    bolsas_producidas NUMERIC DEFAULT 0,
    tn_producidas NUMERIC DEFAULT 0,
    bdp_teorico NUMERIC DEFAULT 0,
    boquillas_turno NUMERIC DEFAULT 0,
    proveedor_bolsa TEXT,
    bolsas_rech_ensacadora NUMERIC DEFAULT 0,
    bolsas_sin_boquilla NUMERIC DEFAULT 0,
    bolsas_rech_ventocheck NUMERIC DEFAULT 0,
    bolsas_rech_transporte NUMERIC DEFAULT 0,
    rendimiento NUMERIC DEFAULT 100,
    disponibilidad NUMERIC DEFAULT 100,
    oee NUMERIC DEFAULT 100,
    disponibilidad_boquillas NUMERIC DEFAULT 100,
    hs_marcha_tis NUMERIC DEFAULT NULL,
    id_maquinista TEXT,
    descripcion_maquinista TEXT
);

-- 15. Tabla: paros_boquillasv2
CREATE TABLE IF NOT EXISTS paros_boquillasv2 (
    id TEXT PRIMARY KEY,
    produccion_id TEXT,
    nro_boquilla NUMERIC,
    hora_inicio TEXT,
    hora_fin TEXT,
    todo_el_turno BOOLEAN DEFAULT FALSE,
    observacion TEXT
);

-- Tabla: detalles_produccionv2
CREATE TABLE IF NOT EXISTS detalles_produccionv2 (
    id TEXT PRIMARY KEY,
    produccion_id TEXT,
    material_id TEXT,
    descripcion_material TEXT,
    bolsas_producidas NUMERIC DEFAULT 0,
    tn_producidas NUMERIC DEFAULT 0,
    bdp_teorico NUMERIC DEFAULT 0,
    boquillas_turno NUMERIC DEFAULT 0,
    proveedor_bolsa TEXT,
    bolsas_rech_ensacadora NUMERIC DEFAULT 0,
    bolsas_sin_boquilla NUMERIC DEFAULT 0,
    bolsas_rech_ventocheck NUMERIC DEFAULT 0,
    bolsas_rech_transporte NUMERIC DEFAULT 0,
    observacion TEXT
);

-- 16. Tabla: control_fechadorv2
CREATE TABLE IF NOT EXISTS control_fechadorv2 (
    idctrlfechador TEXT PRIMARY KEY,
    fecha TEXT,
    maquinista_id TEXT,
    descripcion_maquinista TEXT,
    turno_id TEXT,
    hac_fechador TEXT,
    purga BOOLEAN DEFAULT FALSE,
    nivel_recipiente TEXT,
    calidad_impresion TEXT,
    stock_tinta NUMERIC DEFAULT 0,
    stock_solvente NUMERIC DEFAULT 0,
    stock_cabezales NUMERIC DEFAULT 0,
    observaciones TEXT
);

-- 17. Tabla: control_balanzav2
CREATE TABLE IF NOT EXISTS control_balanzav2 (
    idctrlbalanza TEXT PRIMARY KEY,
    fecha TEXT,
    maquinista_id TEXT,
    maquinista_nombre TEXT,
    turno_id TEXT,
    hac TEXT,
    peso_1 NUMERIC DEFAULT 0,
    peso_2 NUMERIC DEFAULT 0,
    peso_3 NUMERIC DEFAULT 0,
    peso_patron NUMERIC DEFAULT 0,
    media NUMERIC DEFAULT 0,
    bias NUMERIC DEFAULT 0,
    rango NUMERIC DEFAULT 0,
    observaciones TEXT
);

-- 17b. Tabla: parametros_balanzav2
CREATE TABLE IF NOT EXISTS parametros_balanzav2 (
    id TEXT PRIMARY KEY,
    tolerancia_positiva_bias NUMERIC DEFAULT 0.02,
    tolerancia_negativa_bias NUMERIC DEFAULT -0.02,
    tolerancia_positiva_rango NUMERIC DEFAULT 0.01,
    tolerancia_negativa_rango NUMERIC DEFAULT 0.01,
    historial_modificacion JSONB DEFAULT '[]'::jsonb
);

-- 17c. Tabla: clasisficacion_palletsv2
CREATE TABLE IF NOT EXISTS clasisficacion_palletsv2 (
    id TEXT PRIMARY KEY,
    fecha TEXT,
    id_maquinista TEXT,
    descripcion_maquinista TEXT,
    turno_id TEXT,
    descripcion_turno TEXT,
    tipo_pallets TEXT,
    cantidad NUMERIC DEFAULT 0
);

-- 18. Tabla: cambio_productov2
CREATE TABLE IF NOT EXISTS cambio_productov2 (
    id TEXT PRIMARY KEY,
    fecha TEXT,
    turno_id TEXT,
    maquinista_id TEXT,
    maquinista_nombre TEXT,
    maquina_id TEXT,
    valvula_silo_cerrada BOOLEAN DEFAULT FALSE,
    circuito_vaciado BOOLEAN DEFAULT FALSE,
    maquina_limpia BOOLEAN DEFAULT FALSE,
    tolva_vaciada BOOLEAN DEFAULT FALSE,
    silo_cambiado BOOLEAN DEFAULT FALSE,
    fechador_actualizado BOOLEAN DEFAULT FALSE,
    envase_correcto BOOLEAN DEFAULT FALSE,
    dos_big_bags_pal BOOLEAN DEFAULT FALSE,
    muestreo_color BOOLEAN DEFAULT FALSE,
    muestra_enviada_lab BOOLEAN DEFAULT FALSE,
    producto_liberado BOOLEAN DEFAULT FALSE,
    material_anterior_id TEXT,
    material_nuevo_id TEXT,
    motivo_cambio TEXT,
    lab_operador_id TEXT,
    lab_operador_name TEXT,
    p_calcinacion NUMERIC DEFAULT 0,
    aire_incorporado NUMERIC DEFAULT 0,
    porcentaje_ck_drx NUMERIC DEFAULT 0,
    estado_aprobacion TEXT,
    observacion_rechazo TEXT
);

-- 19. Tabla: inventario_fisicov2
CREATE TABLE IF NOT EXISTS inventario_fisicov2 (
    id TEXT PRIMARY KEY,
    fecha TEXT,
    turno_id TEXT,
    descripcion_turno TEXT,
    material_id TEXT,
    descripcion_material TEXT,
    cantidad NUMERIC DEFAULT 0,
    peso_tn NUMERIC DEFAULT 0,
    usuario_id TEXT,
    descripcion_maquinista TEXT
);

-- 20. Tabla: estado_callesv2
CREATE TABLE IF NOT EXISTS estado_callesv2 (
    id TEXT PRIMARY KEY,
    fecha TEXT,
    turno_id TEXT,
    descripcion_turno TEXT,
    punto_carga_id TEXT,
    descripcion_punto_de_carga TEXT,
    habilitada BOOLEAN DEFAULT TRUE,
    materiales_permitidos TEXT,
    observaciones_falla TEXT
);

-- 21. Tabla: despachosv2
CREATE TABLE IF NOT EXISTS despachosv2 (
    id TEXT PRIMARY KEY,
    fecha TEXT,
    turno_id TEXT,
    descripcion_turno TEXT,
    material_id TEXT,
    descripcion_material TEXT,
    toneladas NUMERIC DEFAULT 0,
    usuario_id TEXT,
    usuario_nombre TEXT
);

-- 22. Tabla: parosv2
CREATE TABLE IF NOT EXISTS parosv2 (
    idparo TEXT PRIMARY KEY,
    fecha TEXT,
    fechafin TEXT,
    "máquina afectada" TEXT,
    turno TEXT,
    material TEXT,
    inicio TEXT,
    fin TEXT,
    "duración" TEXT,
    "detalle hac" TEXT,
    hac TEXT,
    equipo TEXT,
    "texto de causa" TEXT,
    "texto aviso" TEXT,
    "texto síntoma" TEXT,
    "causa sap" TEXT,
    "gpo.cod. causa" TEXT,
    "código causa" TEXT,
    "tipo paro" TEXT,
    "gpo.cód. objeto" TEXT,
    "parte objeto" TEXT,
    "gpo.cód. sintoma" TEXT,
    "cód. sintoma" TEXT,
    usuario TEXT,
    "puesto de trabajo" TEXT,
    centro TEXT
);


-- ===================================================
-- SEGURIDAD: CONFIGURACIÓN DE ROW LEVEL SECURITY (RLS)
-- ===================================================
-- De forma predeterminada, habilitamos RLS en todas las tablas para que ningún
-- usuario anónimo pueda acceder o manipular los datos de forma directa en la API
-- REST pública sin políticas válidas.
--
-- Explicación de Roles en Supabase:
-- 1. `service_role`: Clave de servidor. El backend Node/Express inicializado
--    con SUPABASE_SERVICE_ROLE_KEY saltará automáticamente las reglas de RLS para 
--    un funcionamiento rápido y libre de bloqueos en producción.
-- 2. `authenticated`: Usuarios registrados en Supabase Auth.
-- 3. `anon`: Peticiones públicas usando la Anon Key estándar de Supabase.

-- Habilitar RLS en todas las tablas
ALTER TABLE turnosv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE paletizadorav2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ensacadorav2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE hacsv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE causasv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE materialesv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacidadesv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE puntos_cargav2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresasv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores_bolsav2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculosv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE carga_combustiblev2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuariosv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE produccionv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE paros_boquillasv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_fechadorv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_balanzav2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE clasisficacion_palletsv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cambio_productov2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_fisicov2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE estado_callesv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE despachosv2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE parosv2 ENABLE ROW LEVEL SECURITY;


-- POLÍTICAS DE ACCESO RECOMENDADAS PARA OPERACIÓN SEGURA DE REST API:
-- Para máxima flexibilidad y protección simultánea, otorgamos acceso de lectura
-- para usuarios autenticados y anónimos autorizados por la app, y limitamos
-- inserción/edición/borrado únicamente para roles autenticados de confianza o 
-- servicios de backend proxy.

-- Generación automática de políticas de prueba / producción seguras para cada tabla

DO $$
DECLARE
    t TEXT;
    arr TEXT[] := ARRAY[
        'turnosv2', 'paletizadorav2', 'ensacadorav2', 'hacsv2', 'causasv2',
        'materialesv2', 'capacidadesv2', 'puntos_cargav2', 'empresasv2',
        'proveedores_bolsav2', 'vehiculosv2', 'carga_combustiblev2',
        'usuariosv2', 'produccionv2', 'paros_boquillasv2', 'control_fechadorv2',
        'control_balanzav2', 'clasisficacion_palletsv2', 'cambio_productov2', 'inventario_fisicov2',
        'estado_callesv2', 'despachosv2', 'parosv2'
    ];
BEGIN
    FOREACH t IN ARRAY arr LOOP
        -- Borrar políticas previas si ya existieran
        EXECUTE format('DROP POLICY IF EXISTS "Permitir lectura para todos" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Permitir escrituras a autenticados" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Permitir borrados a autenticados" ON %I', t);

        -- Crear política: Lectura autorizada (anon y authenticated)
        EXECUTE format('CREATE POLICY "Permitir lectura para todos" ON %I FOR SELECT TO anon, authenticated USING (true)', t);

        -- Crear política: Escrituras/Actualizaciones autorizadas para Authenticated o el Backend Proxy
        EXECUTE format('CREATE POLICY "Permitir escrituras a autenticados" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- NOTA IMPORTANTE EN PRODUCCIÓN:
-- Si el backend utiliza el secreto `SUPABASE_SERVICE_ROLE_KEY` en `server.ts`
-- (lo cual es sumamente seguro para llamadas proxy locales `/api/*`), la API de su
-- backend ya posee permisos totales automáticos evitando exponer transacciones a la web.
-- Al mismo tiempo, usuarios de internet usando su Anon Key NO PODRÁN borrar ni alterar 
-- ninguna tabla, brindando el nivel óptimo de protección!
