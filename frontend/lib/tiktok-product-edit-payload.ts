/** Helpers to map TikTok product GET detail → edit form → `PUT /product/202509/products/{id}` body. */

export type TiktokEditSaveMode = "AS_DRAFT" | "LISTING"

export interface TiktokEditSkuRow {
  id: string
  sellerSku: string
  attrId: string
  attrName: string
  valueId: string
  valueName: string
  currency: string
  salePrice: string
  amount: string
  warehouseId: string
  quantity: string
  backorderQuantity: string
  handlingTime: string
}

export interface TiktokProductEditFormState {
  saveMode: TiktokEditSaveMode
  title: string
  descriptionHtml: string
  categoryId: string
  brandId: string
  mainImageUri: string
  categoryVersion: string
  isCodAllowed: boolean
  minimumOrderQuantity: string
  inventoryMode: string
  locale: string
  autoTranslateEnabled: boolean
  shippingTemplateId: string
  externalProductId: string
  videoId: string
  searchTermsLine: string
  keyFeaturesLines: string
  packageWeightValue: string
  packageWeightUnit: string
  pkgLen: string
  pkgWid: string
  pkgHt: string
  pkgUnit: string
  sizeChartImageUri: string
  sizeChartTemplateId: string
  skuRows: TiktokEditSkuRow[]
}

function asRec(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function htmlToPlainText(input: string): string {
  if (!input.trim()) return ""

  const withBreaks = input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n")
    .replace(/<\s*\/li\s*>/gi, "\n")

  const noTags = withBreaks.replace(/<[^>]*>/g, "")
  const decoded = decodeHtmlEntities(noTags).replace(/\r/g, "")
  return decoded
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
}

export function emptyTiktokProductEditForm(): TiktokProductEditFormState {
  return {
    saveMode: "AS_DRAFT",
    title: "",
    descriptionHtml: "",
    categoryId: "",
    brandId: "",
    mainImageUri: "",
    categoryVersion: "v1",
    isCodAllowed: false,
    minimumOrderQuantity: "1",
    inventoryMode: "SHARED",
    locale: "en-US",
    autoTranslateEnabled: false,
    shippingTemplateId: "",
    externalProductId: "",
    videoId: "",
    searchTermsLine: "",
    keyFeaturesLines: "",
    packageWeightValue: "",
    packageWeightUnit: "KILOGRAM",
    pkgLen: "",
    pkgWid: "",
    pkgHt: "",
    pkgUnit: "CENTIMETER",
    sizeChartImageUri: "",
    sizeChartTemplateId: "",
    skuRows: [],
  }
}

function categoryIdFromData(data: Record<string, unknown>): string {
  const direct = data.category_id
  if (typeof direct === "string" && direct.trim()) return direct.trim()
  const rec0 = Array.isArray(data.recommended_categories) ? asRec(data.recommended_categories[0]) : null
  if (rec0 && typeof rec0.id === "string") return rec0.id
  const chains = Array.isArray(data.category_chains) ? data.category_chains : []
  const leaf = [...chains].reverse().find((c) => asRec(c)?.is_leaf === true) || chains[0]
  const cr = asRec(leaf)
  return typeof cr?.id === "string" ? cr.id : ""
}

export function hydrateTiktokEditFormFromDetailData(data: Record<string, unknown>): TiktokProductEditFormState {
  const brand = asRec(data.brand)
  const main0 = Array.isArray(data.main_images) ? asRec(data.main_images[0]) : null
  const vid = asRec(data.video)
  const pkgW = asRec(data.package_weight)
  const pkgD = asRec(data.package_dimensions)
  const sch = asRec(data.size_chart)
  const schImg = sch ? asRec(sch.image) : null
  const tmpl = sch ? asRec(sch.template) : null

  const skus = Array.isArray(data.skus) ? data.skus : []
  const skuRows: TiktokEditSkuRow[] = skus.map((raw) => {
    const sku = asRec(raw) || {}
    const price = asRec(sku.price) || {}
    const inv0 = Array.isArray(sku.inventory) ? asRec(sku.inventory[0]) : null
    const attrs = Array.isArray(sku.sales_attributes) ? sku.sales_attributes : []
    const a0 = asRec(attrs[0]) || {}
    return {
      id: sku.id != null ? String(sku.id) : "",
      sellerSku: typeof sku.seller_sku === "string" ? sku.seller_sku : "",
      attrId: typeof a0.id === "string" ? a0.id : String(a0.id ?? ""),
      attrName: typeof a0.name === "string" ? a0.name : "",
      valueId: typeof a0.value_id === "string" ? a0.value_id : String(a0.value_id ?? ""),
      valueName: typeof a0.value_name === "string" ? a0.value_name : "",
      currency: typeof price.currency === "string" ? price.currency : "USD",
      salePrice: price.sale_price != null ? String(price.sale_price) : "",
      amount:
        price.amount != null
          ? String(price.amount)
          : price.sale_price != null
            ? String(price.sale_price)
            : "",
      warehouseId: inv0?.warehouse_id != null ? String(inv0.warehouse_id) : "",
      quantity: inv0?.quantity != null ? String(inv0.quantity) : "",
      backorderQuantity: inv0?.backorder_quantity != null ? String(inv0.backorder_quantity) : "",
      handlingTime: inv0?.handling_time != null ? String(inv0.handling_time) : "",
    }
  })

  const terms = Array.isArray(data.search_terms)
    ? (data.search_terms as unknown[]).filter((x): x is string => typeof x === "string")
    : []
  const feats = Array.isArray(data.key_product_features)
    ? (data.key_product_features as unknown[]).filter((x): x is string => typeof x === "string")
    : []

  return {
    saveMode: "AS_DRAFT",
    title: typeof data.title === "string" ? data.title : "",
    descriptionHtml: typeof data.description === "string" ? htmlToPlainText(data.description) : "",
    categoryId: categoryIdFromData(data),
    brandId: brand?.id != null ? String(brand.id) : "",
    mainImageUri: typeof main0?.uri === "string" ? main0.uri : "",
    categoryVersion: typeof data.category_version === "string" ? data.category_version : "v1",
    isCodAllowed: data.is_cod_allowed === true,
    minimumOrderQuantity: data.minimum_order_quantity != null ? String(data.minimum_order_quantity) : "1",
    inventoryMode: typeof data.inventory_mode === "string" ? data.inventory_mode : "SHARED",
    locale: typeof data.locale === "string" ? data.locale : "en-US",
    autoTranslateEnabled: data.auto_translate_enabled === true,
    shippingTemplateId: typeof data.shipping_template_id === "string" ? data.shipping_template_id : "",
    externalProductId: typeof data.external_product_id === "string" ? data.external_product_id : "",
    videoId: typeof vid?.id === "string" ? vid.id : "",
    searchTermsLine: terms.join(", "),
    keyFeaturesLines: feats.join("\n"),
    packageWeightValue: pkgW?.value != null ? String(pkgW.value) : "",
    packageWeightUnit: typeof pkgW?.unit === "string" ? String(pkgW.unit) : "KILOGRAM",
    pkgLen: pkgD?.length != null ? String(pkgD.length) : "",
    pkgWid: pkgD?.width != null ? String(pkgD.width) : "",
    pkgHt: pkgD?.height != null ? String(pkgD.height) : "",
    pkgUnit: typeof pkgD?.unit === "string" ? String(pkgD.unit) : "CENTIMETER",
    sizeChartImageUri: typeof schImg?.uri === "string" ? schImg.uri : "",
    sizeChartTemplateId: tmpl?.id != null ? String(tmpl.id) : "",
    skuRows,
  }
}

function parseComma(line: string): string[] {
  return line
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseLines(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function buildTiktok202509UpdatePayload(
  form: TiktokProductEditFormState,
  original: Record<string, unknown>,
): Record<string, unknown> {
  const moq = Number.parseInt(form.minimumOrderQuantity, 10)
  const origSkus = Array.isArray(original.skus) ? original.skus : []

  const skusBuilt =
    form.skuRows.length > 0
      ? form.skuRows.map((row, idx) => {
          const origSku = asRec(origSkus[idx]) || {}
          const origInv = Array.isArray(origSku.inventory) ? origSku.inventory : []
          const inv0 = asRec(origInv[0]) || {}
          const warehouseId =
            row.warehouseId.trim() ||
            (inv0.warehouse_id != null ? String(inv0.warehouse_id) : "")
          const qty = Number.parseInt(row.quantity, 10)
          const invRow: Record<string, unknown> = {
            warehouse_id: warehouseId,
            quantity: Number.isFinite(qty) ? qty : 0,
          }
          const bo = Number.parseInt(row.backorderQuantity, 10)
          if (Number.isFinite(bo)) invRow.backorder_quantity = bo
          const ht = Number.parseInt(row.handlingTime, 10)
          if (Number.isFinite(ht)) invRow.handling_time = ht

          const sale = row.salePrice.trim()
          const amt = (row.amount || row.salePrice).trim()
          const origPrice = asRec(origSku.price) || {}

          const attr: Record<string, unknown> = {}
          if (row.attrId.trim()) attr.id = row.attrId.trim()
          if (row.attrName.trim()) attr.name = row.attrName.trim()
          if (row.valueId.trim()) attr.value_id = row.valueId.trim()
          if (row.valueName.trim()) attr.value_name = row.valueName.trim()

          const mergedSku: Record<string, unknown> = { ...origSku }
          if (row.id.trim()) mergedSku.id = row.id.trim()
          mergedSku.seller_sku = row.sellerSku.trim()
          if (Object.keys(attr).length) {
            mergedSku.sales_attributes = [attr]
          }
          mergedSku.price = {
            ...origPrice,
            currency: row.currency.trim() || "USD",
            sale_price: sale,
            amount: amt || sale,
          }
          mergedSku.inventory = [invRow]
          return mergedSku
        })
      : origSkus

  const payload: Record<string, unknown> = {
    save_mode: form.saveMode,
    title: form.title.trim(),
    description: form.descriptionHtml,
    category_id: form.categoryId.trim(),
    brand_id: form.brandId.trim(),
    category_version: form.categoryVersion.trim() || "v1",
    main_images: form.mainImageUri.trim() ? [{ uri: form.mainImageUri.trim() }] : [],
    skus: skusBuilt,
    is_cod_allowed: form.isCodAllowed,
    minimum_order_quantity: Number.isFinite(moq) ? moq : 1,
    inventory_mode: form.inventoryMode.trim() || "SHARED",
    locale: form.locale.trim() || "en-US",
    auto_translate_enabled: form.autoTranslateEnabled,
    search_terms: parseComma(form.searchTermsLine),
    key_product_features: parseLines(form.keyFeaturesLines),
  }

  if (form.packageWeightValue.trim()) {
    payload.package_weight = {
      value: form.packageWeightValue.trim(),
      unit: form.packageWeightUnit.trim() || "KILOGRAM",
    }
  }
  if (form.pkgLen.trim() && form.pkgWid.trim() && form.pkgHt.trim()) {
    payload.package_dimensions = {
      length: form.pkgLen.trim(),
      width: form.pkgWid.trim(),
      height: form.pkgHt.trim(),
      unit: form.pkgUnit.trim() || "CENTIMETER",
    }
  }

  if (form.shippingTemplateId.trim()) payload.shipping_template_id = form.shippingTemplateId.trim()
  if (form.externalProductId.trim()) payload.external_product_id = form.externalProductId.trim()
  if (form.videoId.trim()) payload.video = { id: form.videoId.trim() }

  if (form.sizeChartImageUri.trim() || form.sizeChartTemplateId.trim()) {
    const sc: Record<string, unknown> = {}
    if (form.sizeChartImageUri.trim()) sc.image = { uri: form.sizeChartImageUri.trim() }
    if (form.sizeChartTemplateId.trim()) sc.template = { id: form.sizeChartTemplateId.trim() }
    payload.size_chart = sc
  }

  const passThrough = [
    "certifications",
    "product_attributes",
    "replicated_products",
    "manufacturer_ids",
    "responsible_person_ids",
    "listing_platforms",
    "shipping_insurance_requirement",
    "is_pre_owned",
    "scheduled_sale",
  ] as const
  for (const key of passThrough) {
    if (original[key] != null) payload[key] = original[key]
  }

  if (original.subscribe_info_edit != null) {
    payload.subscribe_info_edit = original.subscribe_info_edit
  } else {
    const sub = asRec(original.subscribe_info)
    if (sub) {
      payload.subscribe_info_edit = {
        subscribe_status: typeof sub.subscribe_status === "string" ? sub.subscribe_status : "ENABLED",
        discount_details: Array.isArray(sub.subscribe_discount_details) ? sub.subscribe_discount_details : [],
      }
    }
  }

  if (Array.isArray(original.delivery_option_ids)) {
    payload.delivery_option_ids = original.delivery_option_ids
  } else if (Array.isArray(original.delivery_options)) {
    const ids = (original.delivery_options as unknown[])
      .map((d) => asRec(d)?.id)
      .filter((x): x is string => typeof x === "string" && Boolean(x))
    if (ids.length) payload.delivery_option_ids = ids
  }

  return payload
}
