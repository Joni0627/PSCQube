import { Router } from "express";
import { readFromSupabase } from "../services/supabase.service.js";

const router = Router();

router.get("/api/sync/maestros", async (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  try {
    const [
      turnos,
      paletizadoras,
      ensacadoras,
      hacs,
      causas,
      materiales,
      capacidades,
      usuarios,
      empresas,
      puntoscarga,
      proveedoresbolsa,
      vehiculos,
      parametrosbalanza
    ] = await Promise.all([
      readFromSupabase("TURNOSV2").then(r => r || []).catch(() => []),
      readFromSupabase("PALETIZADORAV2").then(r => r || []).catch(() => []),
      readFromSupabase("ENSACADORAV2").then(r => r || []).catch(() => []),
      readFromSupabase("HACSV2").then(r => r || []).catch(() => []),
      readFromSupabase("CAUSASV2").then(r => r || []).catch(() => []),
      readFromSupabase("MATERIALESV2").then(r => r || []).catch(() => []),
      readFromSupabase("CAPACIDADESV2").then(r => r || []).catch(() => []),
      readFromSupabase("USUARIOSV2").then(r => r || []).catch(() => []),
      readFromSupabase("EMPRESASV2").then(r => r || []).catch(() => []),
      readFromSupabase("PUNTOS_CARGAV2").then(r => r || []).catch(() => []),
      readFromSupabase("PROVEEDORES_BOLSAV2").then(r => r || []).catch(() => []),
      readFromSupabase("VEHICULOSV2").then(r => r || []).catch(() => []),
      readFromSupabase("PARAMETROS_BALANZAV2").then(r => r || []).catch(() => [])
    ]);

    return res.json({
      success: true,
      data: {
        turnos,
        paletizadoras,
        ensacadoras,
        hacs,
        causas,
        materiales,
        capacidades,
        usuarios,
        empresas,
        puntoscarga,
        proveedoresbolsa,
        vehiculos,
        parametrosbalanza
      }
    });
  } catch (error: any) {
    console.error("Error in /api/sync/maestros:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error"
    });
  }
});

export default router;
