export interface TableSchema {
  sheetHeaders: string[];
  clientToSheet: Record<string, string>;
  sheetToClient: Record<string, string>;
}

export const TABLE_SCHEMAS: Record<string, TableSchema> = {
  TURNOSV2: {
    sheetHeaders: ["id", "name", "start_time", "end_time", "duration_hours"],
    clientToSheet: {
      id: "id",
      name: "name",
      startTime: "start_time",
      endTime: "end_time",
      durationHours: "duration_hours"
    },
    sheetToClient: {
      id: "id",
      name: "name",
      start_time: "startTime",
      startTime: "startTime",
      end_time: "endTime",
      endTime: "endTime",
      duration_hours: "durationHours",
      durationHours: "durationHours"
    }
  },
  PALETIZADORAV2: {
    sheetHeaders: ["id", "tipo", "nombre", "hac_id"],
    clientToSheet: {
      id: "id",
      type: "tipo",
      name: "nombre",
      hacId: "hac_id"
    },
    sheetToClient: {
      id: "id",
      tipo: "type",
      nombre: "name",
      hac_id: "hacId"
    }
  },
  ENSACADORAV2: {
    sheetHeaders: ["id", "tipo", "nombre", "boquillas", "hac_id", "es_punto_de_muestreo"],
    clientToSheet: {
      id: "id",
      type: "tipo",
      name: "nombre",
      nozzles: "boquillas",
      hacId: "hac_id",
      isSamplingPoint: "es_punto_de_muestreo"
    },
    sheetToClient: {
      id: "id",
      tipo: "type",
      nombre: "name",
      boquillas: "nozzles",
      hac_id: "hacId",
      es_punto_de_muestreo: "isSamplingPoint",
      "es_punto_de_muestreo?": "isSamplingPoint"
    }
  },
  HACSV2: {
    sheetHeaders: ["id", "hac", "descripcion_hac", "gpo_codigo_objeto", "equipo", "es_fechador", "es_balanza"],
    clientToSheet: {
      id: "id",
      hac: "hac",
      detail: "descripcion_hac",
      gpoCodObjeto: "gpo_codigo_objeto",
      equipment: "equipo",
      isDater: "es_fechador",
      isScale: "es_balanza"
    },
    sheetToClient: {
      id: "id",
      hac: "hac",
      descripcion_hac: "detail",
      detalle_hac: "detail",
      "detalle hac": "detail",
      detalle: "detail",
      descripcion: "detail",
      descripción: "detail",
      gpo_codigo_objeto: "gpoCodObjeto",
      "gpo.cód. objeto": "gpoCodObjeto",
      grupo_codigo_objeto: "gpoCodObjeto",
      equipo: "equipment",
      "es_fechador?": "isDater",
      es_fechador: "isDater",
      "es_balanza?": "isScale",
      es_balanza: "isScale"
    }
  },
  CAUSASV2: {
    sheetHeaders: [
      "id",
      "hac",
      "descripcion",
      "parte_objeto",
      "grupo_codigo_sintoma",
      "codigo_sintoma",
      "causa_sap",
      "grupo_codigo_causa",
      "codigo_causa",
      "tipo_paro"
    ],
    clientToSheet: {
      id: "id",
      hac: "hac",
      text: "descripcion",
      partObject: "parte_objeto",
      symptomGroup: "grupo_codigo_sintoma",
      symptomCode: "codigo_sintoma",
      sapCause: "causa_sap",
      causeGroup: "grupo_codigo_causa",
      causeCode: "codigo_causa",
      stopType: "tipo_paro"
    },
    sheetToClient: {
      id: "id",
      hac: "hac",
      descripcion: "text",
      descripción: "text",
      "texto de causa": "text",
      texto_de_causa: "text",
      parte_objeto: "partObject",
      "parte objeto": "partObject",
      grupo_código_sintoma: "symptomGroup",
      grupo_codigo_sintoma: "symptomGroup",
      "gpo.cód. sintoma": "symptomGroup",
      "gpo.cód. síntoma": "symptomGroup",
      gpo_cod_sintoma: "symptomGroup",
      codigo_sintoma: "symptomCode",
      código_sintoma: "symptomCode",
      "cód. sintoma": "symptomCode",
      "cód. síntoma": "symptomCode",
      causa_sap: "sapCause",
      "causa sap": "sapCause",
      grupo_codigo_causa: "causeGroup",
      "gpo.cod. causa": "causeGroup",
      gpo_cod_causa: "causeGroup",
      codigo_causa: "causeCode",
      "código causa": "causeCode",
      tipo_paro: "stopType",
      "tipo paro": "stopType"
    }
  },
  MATERIALESV2: {
    sheetHeaders: [
      "id",
      "nombre",
      "codigo_sap",
      "peso_embalaje",
      "peso_bolsa",
      "es_pallet",
      "es_productivo",
      "es_insumo",
      "es_bigbag",
      "es_despacho",
      "es_granel"
    ],
    clientToSheet: {
      id: "id",
      name: "nombre",
      code: "codigo_sap",
      packingWeight: "peso_embalaje",
      bagWeight: "peso_bolsa",
      isPallet: "es_pallet",
      isProductive: "es_productivo",
      isSupply: "es_insumo",
      isBigBag: "es_bigbag",
      isDispatch: "es_despacho",
      isBulk: "es_granel"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      codigo_sap: "code",
      peso_embalaje: "packingWeight",
      peso_bolsa: "bagWeight",
      es_pallet: "isPallet",
      "es_pallet?": "isPallet",
      es_productivo: "isProductive",
      "es_productivo?": "isProductive",
      es_insumo: "isSupply",
      "es_insumo?": "isSupply",
      es_bigbag: "isBigBag",
      "es_bigbag?": "isBigBag",
      es_despacho: "isDispatch",
      "es_despacho?": "isDispatch",
      es_granel: "isBulk",
      "es_granel?": "isBulk"
    }
  },
  CAPACIDADESV2: {
    sheetHeaders: ["id", "ensacadora_id", "peletizadora_id", "material_id", "bdp"],
    clientToSheet: {
      id: "id",
      baggerId: "ensacadora_id",
      palletizerId: "peletizadora_id",
      materialId: "material_id",
      bdp: "bdp"
    },
    sheetToClient: {
      id: "id",
      ensacadora_id: "baggerId",
      peletizadora_id: "palletizerId",
      material_id: "materialId",
      bdp: "bdp"
    }
  },
  PUNTOS_CARGAV2: {
    sheetHeaders: ["id", "nombre", "tipo", "material_ids"],
    clientToSheet: {
      id: "id",
      name: "nombre",
      type: "tipo",
      materialIds: "material_ids"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      tipo: "type",
      material_ids: "materialIds"
    }
  },
  EMPRESASV2: {
    sheetHeaders: ["id", "nombre", "direccion", "cuit", "telefono", "email"],
    clientToSheet: {
      id: "id",
      name: "nombre",
      address: "direccion",
      taxId: "cuit",
      phone: "telefono",
      email: "email"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      direccion: "address",
      "dirección": "address",
      cuit: "taxId",
      telefono: "phone",
      email: "email"
    }
  },
  PROVEEDORES_BOLSAV2: {
    sheetHeaders: ["id", "nombre", "direccion", "telefono", "email"],
    clientToSheet: {
      id: "id",
      nombre: "nombre",
      direccion: "direccion",
      telefono: "telefono",
      email: "email"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      direccion: "address",
      telefono: "phone",
      email: "email"
    }
  },
  VEHICULOSV2: {
    sheetHeaders: ["id", "marca", "identificacion", "tipo", "carga_maxima"],
    clientToSheet: {
      id: "id",
      marca: "marca",
      identificación: "identificacion",
      identificacion: "identificacion",
      tipo: "tipo",
      carga_maxima: "carga_maxima"
    },
    sheetToClient: {
      id: "id",
      marca: "marca",
      identificacion: "identificacion",
      "identificación": "identificacion",
      tipo: "tipo",
      carga_maxima: "carga_maxima"
    }
  },
  CARGA_COMBUSTIBLEV2: {
    sheetHeaders: ["id", "fecha", "unidad_movil", "id_operario", "descripcion_operario", "litros_combustible"],
    clientToSheet: {
      id: "id",
      date: "fecha",
      unidad_movil: "unidad_movil",
      id_operario: "id_operario",
      descripcion_operario: "descripcion_operario",
      litros_combustible: "litros_combustible"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      unidad_movil: "unidad_movil",
      id_operario: "id_operario",
      descripcion_operario: "descripcion_operario",
      litros_combustible: "litros_combustible"
    }
  },
  USUARIOSV2: {
    sheetHeaders: ["dni", "nombre", "usuariosap", "email", "email2", "puesto", "perfil", "permisos"],
    clientToSheet: {
      dni: "dni",
      name: "nombre",
      sapUser: "usuariosap",
      email: "email",
      email2: "email2",
      position: "puesto",
      profile: "perfil",
      permissions: "permisos"
    },
    sheetToClient: {
      dni: "dni",
      nombre: "name",
      usuariosap: "sapUser",
      email: "email",
      email2: "email2",
      puesto: "position",
      perfil: "profile",
      permisos: "permissions"
    }
  },
  PRODUCCIONV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "palletizadora_id",
      "hac_paletizadora",
      "ensacadora_id",
      "hac_ensacadora",
      "bolsas_producidas",
      "tn_producidas",
      "boquillas_turno",
      "rendimiento",
      "disponibilidad",
      "oee",
      "disponibilidad_boquillas",
      "hs_marcha_tis",
      "id_maquinista",
      "descripcion_maquinista"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      palletizerId: "palletizadora_id",
      palletizerHac: "hac_paletizadora",
      baggerId: "ensacadora_id",
      baggerHac: "hac_ensacadora",
      bagsProduced: "bolsas_producidas",
      tonsProduced: "tn_producidas",
      availableNozzlesShift: "boquillas_turno",
      yield: "rendimiento",
      availability: "disponibilidad",
      oee: "oee",
      nozzleAvailability: "disponibilidad_boquillas",
      hsMarchaTis: "hs_marcha_tis",
      machinistId: "id_maquinista",
      machinistName: "descripcion_maquinista"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      "descripción_turno": "shiftDescription",
      palletizadora_id: "palletizerId",
      hac_paletizadora: "palletizerHac",
      ensacadora_id: "baggerId",
      hac_ensacadora: "baggerHac",
      bolsas_producidas: "bagsProduced",
      tn_producidas: "tonsProduced",
      boquillas_turno: "availableNozzlesShift",
      rendimiento: "yield",
      disponibilidad: "availability",
      oee: "oee",
      disponibilidad_boquillas: "nozzleAvailability",
      hs_marcha_tis: "hsMarchaTis",
      id_maquinista: "machinistId",
      descripcion_maquinista: "machinistName"
    }
  },
  PAROS_BOQUILLASV2: {
    sheetHeaders: [
      "id",
      "produccion_id",
      "nro_boquilla",
      "hora_inicio",
      "hora_fin",
      "todo_el_turno",
      "observacion"
    ],
    clientToSheet: {
      id: "id",
      productionId: "produccion_id",
      nozzleNumber: "nro_boquilla",
      startTime: "hora_inicio",
      endTime: "hora_fin",
      isAllShift: "todo_el_turno",
      observation: "observacion"
    },
    sheetToClient: {
      id: "id",
      produccion_id: "productionId",
      nro_boquilla: "nozzleNumber",
      hora_inicio: "startTime",
      hora_fin: "endTime",
      todo_el_turno: "isAllShift",
      observacion: "observation"
    }
  },
  DETALLES_PRODUCCIONV2: {
    sheetHeaders: [
      "id",
      "produccion_id",
      "material_id",
      "descripcion_material",
      "bolsas_producidas",
      "tn_producidas",
      "bdp_teorico",
      "boquillas_turno",
      "proveedor_bolsa",
      "bolsas_rech_ensacadora",
      "bolsas_sin_boquilla",
      "bolsas_rech_ventocheck",
      "bolsas_rech_transporte",
      "observacion"
    ],
    clientToSheet: {
      id: "id",
      productionId: "produccion_id",
      materialId: "material_id",
      materialDescription: "descripcion_material",
      bagsProduced: "bolsas_producidas",
      tonsProduced: "tn_producidas",
      bdp: "bdp_teorico",
      availableNozzlesShift: "boquillas_turno",
      bagProvider: "proveedor_bolsa",
      discardedBagsBagger: "bolsas_rech_ensacadora",
      notNozzledBags: "bolsas_sin_boquilla",
      discardedBagsVentocheck: "bolsas_rech_ventocheck",
      discardedBagsTransport: "bolsas_rech_transporte",
      observacion: "observacion"
    },
    sheetToClient: {
      id: "id",
      produccion_id: "productionId",
      material_id: "materialId",
      descripcion_material: "materialDescription",
      bolsas_producidas: "bagsProduced",
      tn_producidas: "tonsProduced",
      bdp_teorico: "bdp",
      boquillas_turno: "availableNozzlesShift",
      proveedor_bolsa: "bagProvider",
      bolsas_rech_ensacadora: "discardedBagsBagger",
      bolsas_sin_boquilla: "notNozzledBags",
      bolsas_rech_ventocheck: "discardedBagsVentocheck",
      bolsas_rech_transporte: "discardedBagsTransport",
      observacion: "observacion"
    }
  },
  CONTROL_FECHADORV2: {
    sheetHeaders: [
      "idctrlfechador",
      "fecha",
      "maquinista_id",
      "descripcion_maquinista",
      "turno_id",
      "hac_fechador",
      "purga",
      "nivel_recipiente",
      "calidad_impresion",
      "stock_tinta",
      "stock_solvente",
      "stock_cabezales",
      "observaciones"
    ],
    clientToSheet: {
      id: "idctrlfechador",
      date: "fecha",
      userId: "maquinista_id",
      userName: "descripcion_maquinista",
      shiftId: "turno_id",
      hac: "hac_fechador",
      purge: "purga",
      containerLevel: "nivel_recipiente",
      printQuality: "calidad_impresion",
      inkStock: "stock_tinta",
      solventStock: "stock_solvente",
      headsStock: "stock_cabezales",
      observations: "observaciones"
    },
    sheetToClient: {
      idctrlfechador: "id",
      fecha: "date",
      maquinista_id: "userId",
      descripcion_maquinista: "userName",
      turno_id: "shiftId",
      hac_fechador: "hac",
      purga: "purge",
      "purga?": "purge",
      nivel_recipiente: "containerLevel",
      calidad_impresion: "printQuality",
      stock_tinta: "inkStock",
      stock_solvente: "solventStock",
      stock_cabezales: "headsStock",
      observaciones: "observations"
    }
  },
  CONTROL_BALANZAV2: {
    sheetHeaders: [
      "idctrlbalanza",
      "fecha",
      "maquinista_id",
      "maquinista_nombre",
      "turno_id",
      "hac",
      "peso_1",
      "peso_2",
      "peso_3",
      "peso_patron",
      "media",
      "bias",
      "rango",
      "observaciones"
    ],
    clientToSheet: {
      id: "idctrlbalanza",
      date: "fecha",
      userId: "maquinista_id",
      userName: "maquinista_nombre",
      shiftId: "turno_id",
      hac: "hac",
      weight1: "peso_1",
      weight2: "peso_2",
      weight3: "peso_3",
      patternWeight: "peso_patron",
      average: "media",
      bias: "bias",
      range: "rango",
      observations: "observaciones"
    },
    sheetToClient: {
      idctrlbalanza: "id",
      fecha: "date",
      maquinista_id: "userId",
      maquinista_nombre: "userName",
      turno_id: "shiftId",
      hac: "hac",
      peso_1: "weight1",
      peso_2: "weight2",
      peso_3: "weight3",
      peso_patron: "patternWeight",
      media: "average",
      bias: "bias",
      rango: "range",
      observaciones: "observations"
    }
  },
  PARAMETROS_BALANZAV2: {
    sheetHeaders: [
      "id",
      "tolerancia_positiva_bias",
      "tolerancia_negativa_bias",
      "tolerancia_positiva_rango",
      "tolerancia_negativa_rango",
      "historial_modificacion"
    ],
    clientToSheet: {
      id: "id",
      positiveBiasTolerance: "tolerancia_positiva_bias",
      negativeBiasTolerance: "tolerancia_negativa_bias",
      positiveRangeTolerance: "tolerancia_positiva_rango",
      negativeRangeTolerance: "tolerancia_negativa_rango",
      modificationHistory: "historial_modificacion"
    },
    sheetToClient: {
      id: "id",
      tolerancia_positiva_bias: "positiveBiasTolerance",
      tolerancia_negativa_bias: "negativeBiasTolerance",
      tolerancia_positiva_rango: "positiveRangeTolerance",
      tolerancia_negativa_rango: "negativeRangeTolerance",
      historial_modificacion: "modificationHistory"
    }
  },
  CLASISFICACION_PALLETSV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "id_maquinista",
      "descripcion_maquinista",
      "turno_id",
      "descripcion_turno",
      "tipo_pallets",
      "cantidad"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      machinistId: "id_maquinista",
      machinistName: "descripcion_maquinista",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      palletType: "tipo_pallets",
      quantity: "cantidad"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      id_maquinista: "machinistId",
      descripcion_maquinista: "machinistName",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      tipo_pallets: "palletType",
      cantidad: "quantity"
    }
  },
  CAMBIO_PRODUCTOV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "maquinista_id",
      "maquinista_nombre",
      "maquina_id",
      "valvula_silo_cerrada",
      "circuito_vaciado",
      "maquina_limpia",
      "tolva_vaciada",
      "silo_cambiado",
      "fechador_actualizado",
      "envase_correcto",
      "dos_big_bags_pal",
      "muestreo_color",
      "muestra_enviada_lab",
      "producto_liberado",
      "material_anterior_id",
      "material_nuevo_id",
      "motivo_cambio",
      "lab_operador_id",
      "lab_operador_name",
      "p_calcinacion",
      "aire_incorporado",
      "porcentaje_ck_drx",
      "estado_aprobacion",
      "observacion_rechazo"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      operatorId: "maquinista_id",
      operatorName: "maquinista_nombre",
      machineId: "maquina_id",
      siloValveClosed: "valvula_silo_cerrada",
      circuitEmptied: "circuito_vaciado",
      machineCleaned: "maquina_limpia",
      hopperEmptied: "tolva_vaciada",
      siloChanged: "silo_cambiado",
      setupChanged: "fechador_actualizado",
      packagingChanged: "envase_correcto",
      twoBigBagsPalletized: "dos_big_bags_pal",
      colorSampling: "muestreo_color",
      sampleSentToLab: "muestra_enviada_lab",
      productReleased: "producto_liberado",
      previousMaterialId: "material_anterior_id",
      newMaterialId: "material_nuevo_id",
      changeReason: "motivo_cambio",
      labOperatorId: "lab_operador_id",
      labOperatorName: "lab_operador_name",
      calcinationLoss: "p_calcinacion",
      incorporatedAir: "aire_incorporado",
      ckPercentageByDrx: "porcentaje_ck_drx",
      approvalStatus: "estado_aprobacion",
      rejectionObservation: "observacion_rechazo"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      maquinista_id: "operatorId",
      maquinista_nombre: "operatorName",
      maquina_id: "machineId",
      valvula_silo_cerrada: "siloValveClosed",
      circuito_vaciado: "circuitEmptied",
      maquina_limpia: "machineCleaned",
      tolva_vaciada: "hopperEmptied",
      silo_cambiado: "siloChanged",
      fechador_actualizado: "setupChanged",
      envase_correcto: "packagingChanged",
      dos_big_bags_pal: "twoBigBagsPalletized",
      muestreo_color: "colorSampling",
      muestra_enviada_lab: "sampleSentToLab",
      producto_liberado: "productReleased",
      material_anterior_id: "previousMaterialId",
      material_nuevo_id: "newMaterialId",
      motivo_cambio: "changeReason",
      lab_operador_id: "labOperatorId",
      lab_operador_name: "labOperatorName",
      p_calcinacion: "calcinationLoss",
      aire_incorporado: "incorporatedAir",
      porcentaje_ck_drx: "ckPercentageByDrx",
      estado_aprobacion: "approvalStatus",
      observacion_rechazo: "rejectionObservation"
    }
  },
  INVENTARIO_FISICOV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "material_id",
      "descripcion_material",
      "cantidad",
      "peso_tn",
      "usuario_id",
      "descripcion_maquinista"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      materialId: "material_id",
      materialDescription: "descripcion_material",
      quantity: "cantidad",
      weightTn: "peso_tn",
      userId: "usuario_id",
      userName: "descripcion_maquinista"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      material_id: "materialId",
      descripcion_material: "materialDescription",
      cantidad: "quantity",
      peso_tn: "weightTn",
      usuario_id: "userId",
      descripcion_maquinista: "userName"
    }
  },
  ESTADO_CALLESV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "punto_carga_id",
      "descripcion_punto_de_carga",
      "habilitada",
      "materiales_permitidos",
      "observaciones_falla"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      loadingPointId: "punto_carga_id",
      loadingPointDescription: "descripcion_punto_de_carga",
      isEnabled: "habilitada",
      materialIds: "materiales_permitidos",
      observation: "observaciones_falla"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      punto_carga_id: "loadingPointId",
      descripcion_punto_de_carga: "loadingPointDescription",
      habilitada: "isEnabled",
      "habilitada?": "isEnabled",
      materiales_permitidos: "materialIds",
      observaciones_falla: "observation"
    }
  },
  DESPACHOSV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "material_id",
      "descripcion_material",
      "toneladas",
      "usuario_id",
      "usuario_nombre"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      materialId: "material_id",
      materialDescription: "descripcion_material",
      tons: "toneladas",
      userId: "usuario_id",
      userName: "usuario_nombre"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      material_id: "materialId",
      descripcion_material: "materialDescription",
      toneladas: "tons",
      usuario_id: "userId",
      usuario_nombre: "userName"
    }
  },
  PAROSV2: {
    sheetHeaders: [
      "idparo",
      "fecha",
      "fechafin",
      "máquina afectada",
      "turno",
      "material",
      "inicio",
      "fin",
      "duración",
      "detalle hac",
      "hac",
      "equipo",
      "texto de causa",
      "texto aviso",
      "texto síntoma",
      "causa sap",
      "gpo.cod. causa",
      "código causa",
      "tipo paro",
      "gpo.cód. objeto",
      "parte objeto",
      "gpo.cód. sintoma",
      "cód. sintoma",
      "usuario",
      "puesto de trabajo",
      "centro"
    ],
    clientToSheet: {
      id: "idparo",
      date: "fecha",
      finishDate: "fechafin",
      machineHacText: "máquina afectada",
      shiftName: "turno",
      materialDescription: "material",
      startTime: "inicio",
      endTime: "fin",
      durationTime: "duración",
      hacDetail: "detalle hac",
      hacName: "hac",
      equipment: "equipo",
      causeText: "texto de causa",
      noticeText: "texto aviso",
      symptomText: "texto síntoma",
      sapCause: "causa sap",
      causeGroup: "gpo.cod. causa",
      causeCode: "código causa",
      stopType: "tipo paro",
      gpoCodObjeto: "gpo.cód. objeto",
      partObject: "parte objeto",
      symptomGroup: "gpo.cód. sintoma",
      symptomCode: "cód. sintoma",
      user: "usuario",
      workCenter: "puesto de trabajo",
      center: "centro"
    },
    sheetToClient: {
      idparo: "id",
      fecha: "date",
      fechafin: "finishDate",
      "máquina afectada": "machineHacText",
      turno: "shiftName",
      material: "materialDescription",
      inicio: "startTime",
      fin: "endTime",
      duración: "durationTime",
      "detalle hac": "hacDetail",
      hac: "hacName",
      equipo: "equipment",
      "texto de causa": "causeText",
      "texto aviso": "noticeText",
      "texto síntoma": "symptomText",
      "causa sap": "sapCause",
      "gpo.cod. causa": "causeGroup",
      "código causa": "causeCode",
      "tipo paro": "stopType",
      "gpo.cód. objeto": "gpoCodObjeto",
      "parte objeto": "partObject",
      "gpo.cód. sintoma": "symptomGroup",
      "cód. sintoma": "symptomCode",
      usuario: "user",
      "puesto de trabajo": "workCenter",
      centro: "center"
    }
  }
};
