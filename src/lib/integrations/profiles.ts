import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import { ERP_PROFILES, type ErpProfile } from "@/lib/export/auth";

export const INTEGRATION_MAPPING_SETTING_KEY = "integration.erp_mapping.v1";

export interface ErpAccountMapping {
  defaultProfile: ErpProfile;
  currency: string;
  siigoDocumentCode: string;
  incomeAccountCode: string;
  expenseAccountCode: string;
  inventoryAccountCode: string;
  cashOrBankAccountCode: string;
  receivableAccountCode: string;
  payableAccountCode: string;
  exemptTaxCode: string;
  taxRatePct: number;
  costCentersBySpecies: Record<string, string>;
}

export const ERP_PROFILE_METADATA: Record<
  ErpProfile,
  {
    id: ErpProfile;
    name: string;
    subtitle: string;
    description: string;
    authHeaderHint: string;
  }
> = {
  siigo: {
    id: "siigo",
    name: "SIIGO Nube",
    subtitle: "Contabilidad Colombia · PUC y comprobantes",
    description:
      "Estructura movimientos con cuentas PUC, terceros, centros de costo por especie/galpón y comprobantes FC/CC listos para importar o consumir vía API.",
    authHeaderHint: "Usa ?profile=siigo en /api/v1/integrations/transactions",
  },
  alegra: {
    id: "alegra",
    name: "Alegra",
    subtitle: "Facturación y contabilidad PyME",
    description:
      "Adapta ingresos, gastos, inventario de alimentos/insumos y terceros a las llaves client/provider, categoryAccount, bankAccount e inventoryAccount de Alegra.",
    authHeaderHint: "Usa ?profile=alegra en /api/v1/integrations/transactions",
  },
  odoo: {
    id: "odoo",
    name: "Odoo Accounting",
    subtitle: "ERP modular · account.move & product.template",
    description:
      "Devuelve apuntes en formato move_type (out_invoice/in_invoice), analytic_distribution y default_code compatibles con conectores Python/n8n hacia Odoo.",
    authHeaderHint: "Usa ?profile=odoo en /api/v1/integrations/transactions",
  },
  zoho: {
    id: "zoho",
    name: "Zoho Books / Inventory",
    subtitle: "Finanzas e inventarios cloud",
    description:
      "Normaliza facturas, cuentas por pagar, SKU e impuestos en los campos invoice/bill, contact_type e item_type usados por Zoho Books y Zoho Inventory.",
    authHeaderHint: "Usa ?profile=zoho en /api/v1/integrations/transactions",
  },
  generic: {
    id: "generic",
    name: "API JSON Genérica",
    subtitle: "BI, n8n, Make o ERP propio",
    description:
      "Contrato JSON canónico con paginación por cursor, filtro incremental updated_since y dimensiones analíticas completas de la granja.",
    authHeaderHint: "Usa ?profile=generic (o omite ?profile) en /api/v1/integrations/*",
  },
};

export const DEFAULT_ERP_MAPPING: ErpAccountMapping = {
  defaultProfile: "generic",
  currency: "COP",
  siigoDocumentCode: "FC",
  incomeAccountCode: "410505",
  expenseAccountCode: "610505",
  inventoryAccountCode: "143505",
  cashOrBankAccountCode: "111005",
  receivableAccountCode: "130505",
  payableAccountCode: "220505",
  exemptTaxCode: "EXENTO_IVA_0",
  taxRatePct: 0,
  costCentersBySpecies: {
    gallina: "CC-PONEDORAS",
    gallo: "CC-REPRODUCCION",
    pollo: "CC-ENGORDE",
    codorniz: "CC-CODORNIZ",
    pato: "CC-PATOS",
    conejo: "CC-CUNICULTURA",
    cuy: "CC-CUYES",
    general: "CC-GENERAL",
  },
};

function cleanCode(value: unknown, fallback: string, maxLen = 40): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed || fallback;
}

export function normalizeErpMapping(raw: unknown): ErpAccountMapping {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawProfile = typeof input.defaultProfile === "string" ? input.defaultProfile.trim().toLowerCase() : "";
  const defaultProfile: ErpProfile = (ERP_PROFILES as readonly string[]).includes(rawProfile)
    ? (rawProfile as ErpProfile)
    : DEFAULT_ERP_MAPPING.defaultProfile;

  const rawRate = Number(input.taxRatePct);
  const taxRatePct = Number.isFinite(rawRate) && rawRate >= 0 && rawRate <= 100 ? Math.round(rawRate * 100) / 100 : 0;

  const mergedCostCenters: Record<string, string> = { ...DEFAULT_ERP_MAPPING.costCentersBySpecies };
  if (input.costCentersBySpecies && typeof input.costCentersBySpecies === "object") {
    for (const [k, v] of Object.entries(input.costCentersBySpecies as Record<string, unknown>)) {
      const key = k.trim().toLowerCase();
      if (key && typeof v === "string" && v.trim()) {
        mergedCostCenters[key] = v.trim().slice(0, 40);
      }
    }
  }

  return {
    defaultProfile,
    currency: cleanCode(input.currency, DEFAULT_ERP_MAPPING.currency, 8).toUpperCase(),
    siigoDocumentCode: cleanCode(input.siigoDocumentCode, DEFAULT_ERP_MAPPING.siigoDocumentCode, 16).toUpperCase(),
    incomeAccountCode: cleanCode(input.incomeAccountCode, DEFAULT_ERP_MAPPING.incomeAccountCode, 30),
    expenseAccountCode: cleanCode(input.expenseAccountCode, DEFAULT_ERP_MAPPING.expenseAccountCode, 30),
    inventoryAccountCode: cleanCode(input.inventoryAccountCode, DEFAULT_ERP_MAPPING.inventoryAccountCode, 30),
    cashOrBankAccountCode: cleanCode(input.cashOrBankAccountCode, DEFAULT_ERP_MAPPING.cashOrBankAccountCode, 30),
    receivableAccountCode: cleanCode(input.receivableAccountCode, DEFAULT_ERP_MAPPING.receivableAccountCode, 30),
    payableAccountCode: cleanCode(input.payableAccountCode, DEFAULT_ERP_MAPPING.payableAccountCode, 30),
    exemptTaxCode: cleanCode(input.exemptTaxCode, DEFAULT_ERP_MAPPING.exemptTaxCode, 40),
    taxRatePct,
    costCentersBySpecies: mergedCostCenters,
  };
}

export async function loadErpMapping(): Promise<ErpAccountMapping> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, INTEGRATION_MAPPING_SETTING_KEY))
    .limit(1);

  if (!row?.value) {
    return normalizeErpMapping({});
  }

  try {
    return normalizeErpMapping(JSON.parse(row.value));
  } catch {
    return normalizeErpMapping({});
  }
}

export async function saveErpMapping(
  patch: unknown,
  updatedBy: string | null = null,
): Promise<ErpAccountMapping> {
  const current = await loadErpMapping();
  const patchObj = patch && typeof patch === "object" ? (patch as Record<string, unknown>) : {};
  const merged = normalizeErpMapping({
    ...current,
    ...patchObj,
    costCentersBySpecies: {
      ...current.costCentersBySpecies,
      ...(patchObj.costCentersBySpecies && typeof patchObj.costCentersBySpecies === "object"
        ? (patchObj.costCentersBySpecies as Record<string, unknown>)
        : {}),
    },
  });

  const farmId = getCurrentFarmId();
  const serialized = JSON.stringify(merged);

  await db
    .insert(appSettings)
    .values({
      farmId,
      key: INTEGRATION_MAPPING_SETTING_KEY,
      value: serialized,
      updatedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [appSettings.farmId, appSettings.key],
      set: {
        value: serialized,
        updatedBy,
        updatedAt: new Date(),
      },
    });

  return merged;
}

export interface CanonicalTransaction {
  id: string;
  date: string;
  type: "ingreso" | "egreso";
  category: string;
  description: string;
  counterparty: string | null;
  amount: number;
  quantity: number | null;
  unitPrice: number | null;
  unit: string | null;
  presentation: string | null;
  species: string | null;
  locationId: string | null;
  locationCode: string | null;
  locationName: string | null;
  batchId: string | null;
  isCredit: boolean;
  sourceType: string | null;
  sourceId: string | null;
  expenseCatalogId?: string | null;
  expenseFamily?: string | null;
  expenseConcept?: string | null;
  expenseTreatment?: string | null;
  capexCatalogId?: string | null;
  capexFamily?: string | null;
  notes: string | null;
  createdAt: string;
}

function resolveCostCenter(
  tx: { species: string | null; locationCode: string | null },
  mapping: ErpAccountMapping,
): string {
  if (tx.locationCode) return tx.locationCode;
  const sp = (tx.species || "general").trim().toLowerCase();
  return mapping.costCentersBySpecies[sp] || mapping.costCentersBySpecies.general || "CC-GENERAL";
}

export function formatTransactionForProfile(
  tx: CanonicalTransaction,
  profile: ErpProfile,
  mapping: ErpAccountMapping,
): Record<string, unknown> {
  const isIncome = tx.type === "ingreso";
  const accountCode = isIncome ? mapping.incomeAccountCode : mapping.expenseAccountCode;
  const counterAccountCode = tx.isCredit
    ? isIncome
      ? mapping.receivableAccountCode
      : mapping.payableAccountCode
    : mapping.cashOrBankAccountCode;
  const costCenter = resolveCostCenter(tx, mapping);
  const qty = tx.quantity ?? 1;
  const unitPrice = tx.unitPrice ?? (qty > 0 ? Math.round((tx.amount / qty) * 100) / 100 : tx.amount);

  if (profile === "siigo") {
    return {
      external_id: tx.id,
      date: tx.date,
      voucher_type: mapping.siigoDocumentCode,
      movement_type: tx.type,
      currency: mapping.currency,
      cost_center: costCenter,
      account_debit: isIncome ? counterAccountCode : accountCode,
      account_credit: isIncome ? accountCode : counterAccountCode,
      third_party_name: tx.counterparty || "Consumidor Final",
      tax_code: mapping.exemptTaxCode,
      tax_rate_pct: mapping.taxRatePct,
      is_credit: tx.isCredit,
      observations: tx.description,
      items: [
        {
          code: tx.expenseCatalogId || tx.category,
          category: tx.expenseFamily || tx.category,
          description: tx.description,
          quantity: qty,
          unit_price: unitPrice,
          unit: tx.unit || "unidad",
          tax_id: mapping.exemptTaxCode,
          total: tx.amount,
        },
      ],
      total: tx.amount,
      created_at: tx.createdAt,
    };
  }

  if (profile === "alegra") {
    return {
      externalId: tx.id,
      date: tx.date,
      type: isIncome ? "income" : "expense",
      category: tx.expenseFamily || tx.category,
      legacyCategory: tx.category,
      expenseCatalogId: tx.expenseCatalogId ?? null,
      expenseFamily: tx.expenseFamily ?? null,
      expenseConcept: tx.expenseConcept ?? null,
      expenseTreatment: tx.expenseTreatment ?? null,
      capexCatalogId: tx.capexCatalogId ?? null,
      capexFamily: tx.capexFamily ?? null,
      categoryAccount: accountCode,
      bankAccount: counterAccountCode,
      costCenter,
      clientOrProviderName: tx.counterparty || "Varios",
      description: tx.description,
      quantity: qty,
      price: unitPrice,
      unit: tx.unit || "unidad",
      taxCode: mapping.exemptTaxCode,
      taxRate: mapping.taxRatePct,
      currency: mapping.currency,
      paymentMethod: tx.isCredit ? "credit" : "cash",
      total: tx.amount,
      createdAt: tx.createdAt,
    };
  }

  if (profile === "odoo") {
    return {
      ref: tx.id,
      date: tx.date,
      move_type: isIncome ? "out_invoice" : "in_invoice",
      partner_name: tx.counterparty || "Varios",
      journal_code: tx.isCredit ? (isIncome ? "SALE" : "PURCH") : "CASH",
      currency_id: mapping.currency,
      analytic_distribution: { [costCenter]: 100 },
      expense_catalog_id: tx.expenseCatalogId ?? null,
      expense_family: tx.expenseFamily ?? null,
      expense_treatment: tx.expenseTreatment ?? null,
      capex_catalog_id: tx.capexCatalogId ?? null,
      capex_family: tx.capexFamily ?? null,
      invoice_line_ids: [
        {
          default_code: tx.expenseCatalogId || null,
          name: tx.description,
          category: tx.expenseFamily || tx.category,
          expense_concept: tx.expenseConcept ?? null,
          account_code: accountCode,
          quantity: qty,
          price_unit: unitPrice,
          tax_ids: [mapping.exemptTaxCode],
        },
      ],
      counterpart_account_code: counterAccountCode,
      amount_total: tx.amount,
      create_date: tx.createdAt,
    };
  }

  if (profile === "zoho") {
    return {
      reference_number: tx.id,
      date: tx.date,
      transaction_type: isIncome ? "invoice" : "bill",
      contact_name: tx.counterparty || "Varios",
      currency_code: mapping.currency,
      account_code: accountCode,
      offset_account_code: counterAccountCode,
      cost_center_tag: costCenter,
      expense_catalog_id: tx.expenseCatalogId ?? null,
      expense_family: tx.expenseFamily ?? null,
      expense_treatment: tx.expenseTreatment ?? null,
      capex_catalog_id: tx.capexCatalogId ?? null,
      capex_family: tx.capexFamily ?? null,
      is_credit: tx.isCredit,
      line_items: [
        {
          sku: tx.expenseCatalogId || null,
          name: tx.expenseFamily || tx.category,
          description: tx.description,
          expense_concept: tx.expenseConcept ?? null,
          account_code: accountCode,
          quantity: qty,
          rate: unitPrice,
          tax_name: mapping.exemptTaxCode,
          tax_percentage: mapping.taxRatePct,
        },
      ],
      total: tx.amount,
      created_time: tx.createdAt,
    };
  }

  return {
    ...tx,
    currency: mapping.currency,
    costCenter,
    accountCode,
    counterAccountCode,
    taxCode: mapping.exemptTaxCode,
    taxRatePct: mapping.taxRatePct,
  };
}

export interface CanonicalInventoryItem {
  id: string;
  sku: string;
  itemType: "alimento" | "insumo";
  name: string;
  category: string;
  subCategory: string | null;
  standardCatalogId?: string | null;
  catalogGroup?: string | null;
  sanitaryStatus?: string | null;
  dryMatterPct?: number | null;
  crudeProteinPct?: number | null;
  unit: string;
  currentStock: number;
  minStock: number;
  costPerUnit: number;
  inventoryValue: number;
  supplier: string | null;
  updatedAt: string;
}

export function formatInventoryItemForProfile(
  item: CanonicalInventoryItem,
  profile: ErpProfile,
  mapping: ErpAccountMapping,
): Record<string, unknown> {
  if (profile === "siigo") {
    return {
      id: item.id,
      code: item.sku,
      standard_catalog_id: item.standardCatalogId ?? null,
      catalog_group: item.catalogGroup ?? null,
      sanitary_status: item.sanitaryStatus ?? null,
      name: item.name,
      account_group: mapping.inventoryAccountCode,
      type: "Product",
      category: item.catalogGroup || item.category,
      unit_label: item.unit,
      available_quantity: item.currentStock,
      min_quantity: item.minStock,
      unit_cost: item.costPerUnit,
      total_value: item.inventoryValue,
      tax_classification: mapping.exemptTaxCode,
      supplier: item.supplier,
      updated_at: item.updatedAt,
    };
  }

  if (profile === "alegra") {
    return {
      id: item.id,
      reference: item.sku,
      standardCatalogId: item.standardCatalogId ?? null,
      catalogGroup: item.catalogGroup ?? null,
      sanitaryStatus: item.sanitaryStatus ?? null,
      name: item.name,
      type: "product",
      category: item.catalogGroup || item.category,
      unit: item.unit,
      availableQuantity: item.currentStock,
      minQuantity: item.minStock,
      unitCost: item.costPerUnit,
      totalValue: item.inventoryValue,
      inventoryAccount: mapping.inventoryAccountCode,
      taxCode: mapping.exemptTaxCode,
      updatedAt: item.updatedAt,
    };
  }

  if (profile === "odoo") {
    return {
      id: item.id,
      default_code: item.sku,
      standard_catalog_id: item.standardCatalogId ?? null,
      catalog_group: item.catalogGroup ?? null,
      sanitary_status: item.sanitaryStatus ?? null,
      name: item.name,
      type: "product",
      categ_name: item.catalogGroup ? `${item.itemType}/${item.catalogGroup}` : `${item.itemType}/${item.category}`,
      uom_name: item.unit,
      qty_available: item.currentStock,
      reordering_min_qty: item.minStock,
      standard_price: item.costPerUnit,
      valuation_total: item.inventoryValue,
      property_stock_valuation_account_id: mapping.inventoryAccountCode,
      write_date: item.updatedAt,
    };
  }

  if (profile === "zoho") {
    return {
      item_id: item.id,
      sku: item.sku,
      standard_catalog_id: item.standardCatalogId ?? null,
      catalog_group: item.catalogGroup ?? null,
      sanitary_status: item.sanitaryStatus ?? null,
      name: item.name,
      item_type: "inventory",
      group_name: item.catalogGroup || item.itemType,
      unit: item.unit,
      stock_on_hand: item.currentStock,
      reorder_level: item.minStock,
      purchase_rate: item.costPerUnit,
      inventory_account_code: mapping.inventoryAccountCode,
      last_modified_time: item.updatedAt,
    };
  }

  return {
    ...item,
    currency: mapping.currency,
    inventoryAccountCode: mapping.inventoryAccountCode,
    taxCode: mapping.exemptTaxCode,
  };
}

export interface CanonicalInventoryMovement {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  itemType: "alimento" | "insumo";
  date: string;
  direction: "entrada" | "salida";
  movementType: string;
  quantity: number;
  unit: string;
  unitCost: number | null;
  totalCost: number | null;
  species: string | null;
  locationCode: string | null;
  notes: string | null;
  createdAt: string;
}

export function formatInventoryMovementForProfile(
  mov: CanonicalInventoryMovement,
  profile: ErpProfile,
  mapping: ErpAccountMapping,
): Record<string, unknown> {
  const costCenter = resolveCostCenter(
    { species: mov.species, locationCode: mov.locationCode },
    mapping,
  );
  if (profile === "siigo" || profile === "alegra" || profile === "odoo" || profile === "zoho") {
    return {
      external_id: mov.id,
      profile,
      date: mov.date,
      sku: mov.sku,
      item_name: mov.itemName,
      item_type: mov.itemType,
      direction: mov.direction,
      movement_type: mov.movementType,
      quantity: mov.quantity,
      unit: mov.unit,
      unit_cost: mov.unitCost,
      total_cost: mov.totalCost,
      inventory_account_code: mapping.inventoryAccountCode,
      expense_account_code: mapping.expenseAccountCode,
      cost_center: costCenter,
      currency: mapping.currency,
      notes: mov.notes,
      created_at: mov.createdAt,
    };
  }

  return {
    ...mov,
    costCenter,
    inventoryAccountCode: mapping.inventoryAccountCode,
    currency: mapping.currency,
  };
}

export interface CanonicalContact {
  id: string;
  name: string;
  role: string;
  personType: string;
  documentType: string | null;
  documentNumber: string | null;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  paymentMethod: string | null;
  creditDays: number;
  isActive: boolean;
  updatedAt: string;
}

export function formatContactForProfile(
  contact: CanonicalContact,
  profile: ErpProfile,
): Record<string, unknown> {
  if (profile === "siigo") {
    return {
      external_id: contact.id,
      type:
        contact.role === "ambos"
          ? ["Customer", "Supplier"]
          : contact.role === "proveedor"
            ? ["Supplier"]
            : ["Customer"],
      person_type: contact.personType === "juridica" ? "Company" : "Person",
      id_type: contact.documentType || "CC",
      identification: contact.documentNumber || "",
      name: [contact.name],
      commercial_name: contact.contactName || contact.name,
      address: {
        address: contact.address || "",
        city: contact.city || "",
        department: contact.department || "",
      },
      phones: [{ number: contact.phone || contact.whatsapp || "" }],
      contacts: [{ email: contact.email || "", phone: contact.phone || "" }],
      credit_days: contact.creditDays,
      active: contact.isActive,
      updated_at: contact.updatedAt,
    };
  }

  if (profile === "alegra") {
    return {
      externalId: contact.id,
      name: contact.name,
      type:
        contact.role === "ambos"
          ? ["client", "provider"]
          : contact.role === "proveedor"
            ? ["provider"]
            : ["client"],
      identificationObject: {
        type: contact.documentType || "CC",
        number: contact.documentNumber || "",
      },
      email: contact.email,
      phonePrimary: contact.phone,
      mobile: contact.whatsapp,
      address: {
        address: contact.address,
        city: contact.city,
        department: contact.department,
      },
      term: contact.creditDays,
      status: contact.isActive ? "active" : "inactive",
      updatedAt: contact.updatedAt,
    };
  }

  if (profile === "odoo") {
    return {
      ref: contact.id,
      name: contact.name,
      company_type: contact.personType === "juridica" ? "company" : "person",
      vat: contact.documentNumber || "",
      customer_rank: contact.role === "cliente" || contact.role === "ambos" ? 1 : 0,
      supplier_rank: contact.role === "proveedor" || contact.role === "ambos" ? 1 : 0,
      email: contact.email,
      phone: contact.phone,
      mobile: contact.whatsapp,
      street: contact.address,
      city: contact.city,
      state_name: contact.department,
      active: contact.isActive,
      write_date: contact.updatedAt,
    };
  }

  if (profile === "zoho") {
    return {
      contact_id: contact.id,
      contact_name: contact.name,
      contact_type: contact.role === "proveedor" ? "vendor" : "customer",
      company_name: contact.personType === "juridica" ? contact.name : contact.contactName || "",
      tax_id: contact.documentNumber || "",
      email: contact.email,
      phone: contact.phone,
      mobile: contact.whatsapp,
      billing_address: {
        address: contact.address,
        city: contact.city,
        state: contact.department,
      },
      payment_terms: contact.creditDays,
      status: contact.isActive ? "active" : "inactive",
      last_modified_time: contact.updatedAt,
    };
  }

  return { ...contact };
}
