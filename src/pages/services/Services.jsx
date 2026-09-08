import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  Building2,
  Check,
  ChevronDown,
  FileText,
  Globe,
  Pencil,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Notice from "../../components/ui/Notice";
import PaymentMethodFields from "../../components/form/PaymentMethodFields.jsx";
import { Dialog } from "../../components/ui/Dialog.tsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useBusinessSettings } from "../../lib/business/businessSettings";
import { getServicesDisplayLabel } from "../../lib/business/businessTypeConfig.js";
import { useI18n } from "../../lib/i18n.jsx";
import { printElement, printThermalReceipt } from "../../lib/print/print.js";
import {
  getJewelleryBreakdown,
  getPurityOptionsForMetal,
  JEWELLERY_ATTRIBUTE_KEYS,
  normalizeJewelleryAttributes,
} from "../../lib/business/jewellery.js";
import { usePartyStore } from "../../stores/parties";
import { useServiceStore } from "../../stores/services";
import { useProductStore } from "../../stores/products";
import { getCreatorDisplayName, getCurrentCreatorValue } from "../../lib/records";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  buildPaymentPayload,
  normalizePaymentFields,
  requiresBankSelection,
} from "../../lib/money/payments";
import { getDueWhatsAppMessage, getWhatsAppLink } from "../../lib/integrations/whatsapp.js";
import {
  mergeLookupEntities,
  normalizeLookupParty,
  normalizeLookupProduct,
  toProductLookupOption,
} from "../../lib/lookups.js";
import {
  getStockAvailabilityMessage,
  isAllStockExpired,
  toAvailableUnitQuantity,
} from "../../lib/inventory/stockAvailability.js";

import {
  todayISODate,
  toDateInputValue,
} from "../../lib/dates/datetime";
import { getPartyBalanceMeta } from "../../lib/money/partyBalances.js";
import { getIrdReprintLabel, isIrdCancelled, isIrdLocked } from "../../lib/compliance/ird";
import { ServiceAttachmentLightbox } from "./ServiceOrderAttachments.jsx";
import ServiceOrderFormDialog from "./ServiceOrderFormDialog.jsx";
import ServiceInvoiceModal from "./ServiceInvoiceModal.jsx";
import ServiceOrderList from "./ServiceOrderList.jsx";
import {
  emptyItem,
  getServiceAttachmentUrls,
  getServiceItems,
  getServiceOrderTotals,
  getVatAmount,
  isPlaceholderItem,
  makeEmptyHeader,
  normalizeAttachmentUrls,
  normalizeServiceOrder,
} from "./serviceOrderUtils.js";

const STATUS_STEPS = [
  {
    value: "in_progress",
    label: "In Progress",
    desc: "Currently being worked on",
    selectedClass: "border-amber-400 bg-amber-50 dark:bg-amber-900/20",
    dotClass: "bg-amber-500",
    checkClass: "text-amber-600",
  },
  {
    value: "closed",
    label: "Closed",
    desc: "Work completed",
    selectedClass: "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
    dotClass: "bg-emerald-500",
    checkClass: "text-emerald-600",
  },
];

export default function Services() {
  const { t } = useI18n();
  const { businessId, user, canManageFeature } = useAuth();
  const canManageServices = canManageFeature("services");
  const [searchParams, setSearchParams] = useSearchParams();
  const createIntentHandledRef = useRef(false);
  const partyPickerRef = useRef(null);
  const partyDropdownRef = useRef(null);
  const { settings: bizSettings, businessProfile } = useBusinessSettings();
  const irdModeEnabled = Boolean(bizSettings?.irdModeEnabled);
  const businessType = String(businessProfile?.type || "").toLowerCase();
  const isGym = businessType === "gym";
  const showGoldJewelleryDetails = businessType === "gold";
  const servicesFlow = businessProfile?.servicesFlow || {};
  const servicesEnabled = servicesFlow.enabled !== false;
  const servicesTitle = getServicesDisplayLabel(
    businessProfile,
    servicesFlow.title || t("services.title"),
  );
  const servicesSubtitle =
    servicesFlow.attributeSectionHint || t("services.subtitle");
  const newOrderLabel =
    businessType === "jewellery" || businessType === "gold"
      ? "New Repair Order"
      : t("services.newOrder");

  const { upsert: upsertParty } = usePartyStore();
  const {
    services: serviceList,
    loading: listLoading,
    total: serviceTotal,
    totalKnown: serviceTotalKnown,
    fetch: fetchServices,
    invalidate: invalidateServices,
    patch: patchService,
  } = useServiceStore();
  const [suggestedOrderNo, setSuggestedOrderNo] = useState("");

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.getServiceStats();
      setStats(res);
    } catch (err) {
      console.error("Failed to fetch service stats", err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (businessId) {
      fetchStats();
    }
  }, [businessId, serviceList, fetchStats]);
  const [productDirectory, setProductDirectory] = useState({});
  const [storeType, setStoreType] = useState("physical");
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);

  const storeOptions = [
    {
      value: "physical",
      label: "Physical store",
      icon: Building2,
      sub: "Walk-in customers",
    },
    {
      value: "online",
      label: "Online store",
      icon: Globe,
      sub: "E-commerce orders",
    },
  ];
  const selectedStore =
    storeOptions.find((o) => o.value === storeType) || storeOptions[0];

  // ── List state ──
  const [statusFilter, setStatusFilter] = useState("all");
  const [storeTypeFilter, setStoreTypeFilter] = useState("all");
  const [listError, setListError] = useState("");
  const [listNotice, setListNotice] = useState({ type: "", message: "" });

  useEffect(() => {
    if (listNotice.type !== "success" && listNotice.type !== "error") return;
    const timer = setTimeout(
      () => setListNotice({ type: "", message: "" }),
      3000,
    );
    return () => clearTimeout(timer);
  }, [listNotice]);

  const [page, setPage] = useState(1);
  const [refreshingServices, setRefreshingServices] = useState(false);
  const refreshInFlightRef = useRef(false);
  const [pageSize, setPageSize] = useState(10);

  // ── New order dialog ──
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formNotice, setFormNotice] = useState({ type: "", message: "" });
  const formNoticeTimerRef = useRef(null);

  useEffect(() => {
    if (formNotice.type !== "success" && formNotice.type !== "error") return;
    const timer = setTimeout(
      () => setFormNotice({ type: "", message: "" }),
      3000,
    );
    return () => clearTimeout(timer);
  }, [formNotice]);

  // ── Payment dialog ──
  const [payDialog, setPayDialog] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payPaymentMethod, setPayPaymentMethod] = useState("cash");
  const [payBankId, setPayBankId] = useState("");
  const [payError, setPayError] = useState("");

  // ── Status dialog ──
  const [statusDialog, setStatusDialog] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusError, setStatusError] = useState("");

  // ── Party filter ──
  const [partyFilterId, setPartyFilterId] = useState("");
  const [selectedPartyFilterOption, setSelectedPartyFilterOption] =
    useState(null);
  const [createdByFilterId, setCreatedByFilterId] = useState("");

  // ── Edit state ──
  const [editingId, setEditingId] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState("");
  const [deleteService, setDeleteService] = useState(null);
  const [cancelService, setCancelService] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingServiceId, setCancellingServiceId] = useState("");

  // ── Lightbox ──
  const [lightboxState, setLightboxState] = useState(null);

  const openLightbox = (urls = [], index = 0) => {
    const normalized = Array.isArray(urls) ? urls : [urls];
    const abs = normalized.map((u) =>
      u && String(u).startsWith("http") ? u : String(u || ""),
    );
    setLightboxState({
      urls: abs,
      index: Math.max(0, Math.min(index || 0, abs.length - 1)),
    });
  };

  const closeLightbox = () => setLightboxState(null);
  const showPrev = () =>
    setLightboxState((s) =>
      s ? { ...s, index: Math.max(0, s.index - 1) } : s,
    );
  const showNext = () =>
    setLightboxState((s) =>
      s ? { ...s, index: Math.min(s.urls.length - 1, s.index + 1) } : s,
    );

  useEffect(() => {
    const handler = (e) => {
      if (!lightboxState) return;
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightboxState]);

  // ── Invoice modal ──
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [isThermalInvoice, setIsThermalInvoice] = useState(false);
  const thermalInvoicePrintRef = useRef(null);

  // ── Attribute definitions for invoice display ──
  const [attributeDefs, setAttributeDefs] = useState([]);
  const safeServiceList = useMemo(
    () =>
      Array.isArray(serviceList) ? serviceList.map(normalizeServiceOrder) : [],
    [serviceList],
  );
  const safeAttributeDefs = Array.isArray(attributeDefs) ? attributeDefs : [];

  // ── Form data ──
  const [partyQuery, setPartyQuery] = useState("");
  const debouncedPartyQuery = useDebouncedValue(partyQuery, 250);
  const [partySearchResults, setPartySearchResults] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partyDropdownStyle, setPartyDropdownStyle] = useState(null);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newPartyPhone, setNewPartyPhone] = useState("");
  const [creatingParty, setCreatingParty] = useState(false);
  const [header, setHeader] = useState(() => makeEmptyHeader());
  const [hasDeliveryDate, setHasDeliveryDate] = useState(true);
  const [vacantTables, setVacantTables] = useState([]);
  const [items, setItems] = useState([]);
  const quantityInputRef = useRef(null);
  const descriptionInputRef = useRef(null);
  const [discount, setDiscount] = useState("0");
  const [amountReceived, setAmountReceived] = useState("0");
  const [isPaid, setIsPaid] = useState(false);

  // ── Items inline form ──
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemDraft, setItemDraft] = useState({ ...emptyItem });
  const [editingItemIdx, setEditingItemIdx] = useState(null);
  const [mobileStep, setMobileStep] = useState("details");
  const jewelleryAttributes = useMemo(
    () => normalizeJewelleryAttributes(header.attributes),
    [header.attributes],
  );
  const jewelleryDetails = useMemo(
    () => getJewelleryBreakdown(jewelleryAttributes),
    [jewelleryAttributes],
  );
  const activeJewelleryDetails = useMemo(
    () =>
      showGoldJewelleryDetails ? jewelleryDetails : getJewelleryBreakdown({}),
    [jewelleryDetails, showGoldJewelleryDetails],
  );
  const jewelleryPurityOptions = useMemo(
    () => getPurityOptionsForMetal(jewelleryAttributes.metalType),
    [jewelleryAttributes.metalType],
  );
  const listParams = useMemo(
    () => ({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(partyFilterId ? { partyId: partyFilterId } : {}),
      ...(createdByFilterId ? { createdBy: createdByFilterId } : {}),
      ...(storeTypeFilter !== "all" ? { storeType: storeTypeFilter } : {}),
    }),
    [createdByFilterId, page, pageSize, partyFilterId, statusFilter, storeTypeFilter],
  );

  const updatePartyDropdownPosition = useCallback(() => {
    const trigger = partyPickerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth =
      window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    const margin = 8;
    const width = Math.min(
      viewportWidth - margin * 2,
      Math.max(rect.width, 360),
    );
    const left = Math.min(
      Math.max(rect.left, margin),
      Math.max(margin, viewportWidth - width - margin),
    );
    const dropdownMaxHeight = 380;
    const minHeight = 180;
    const belowSpace = viewportHeight - rect.bottom - margin - 8;
    const aboveSpace = rect.top - margin - 8;
    const opensAbove = belowSpace < minHeight && aboveSpace > belowSpace;
    const availableHeight = opensAbove ? aboveSpace : belowSpace;
    const maxHeight = Math.max(
      minHeight,
      Math.min(dropdownMaxHeight, availableHeight),
    );
    const top = opensAbove
      ? Math.max(margin, rect.top - maxHeight - 8)
      : rect.bottom + 8;

    setPartyDropdownStyle({ left, top, width, maxHeight });
  }, []);

  // ── Load services list ──
  const loadServices = () => {
    setListError("");
    invalidateServices(listParams);
    return fetchServices(listParams, true).catch((err) =>
      setListError(err.message),
    );
  };

  const refreshServices = async () => {
    if (refreshInFlightRef.current) return;

    refreshInFlightRef.current = true;
    setRefreshingServices(true);
    try {
      await loadServices();
    } finally {
      refreshInFlightRef.current = false;
      setRefreshingServices(false);
    }
  };

  useEffect(() => {
    if (!businessId) return;
    setListError("");
    fetchServices(listParams).catch((err) => setListError(err.message));
  }, [businessId, fetchServices, listParams]);

  useEffect(() => {
    setPage(1);
  }, [createdByFilterId, partyFilterId, statusFilter, storeTypeFilter]);

  useEffect(() => {
    const search = debouncedPartyQuery.trim();

    if (!search || selectedParty) {
      setPartySearchResults([]);
      return;
    }

    let isActive = true;

    api
      .lookupParties({ search, type: "customer", limit: 10 })
      .then((results) => {
        if (!isActive) return;
        setPartySearchResults((results?.items || []).map(normalizeLookupParty));
      })
      .catch(() => {
        if (!isActive) return;
        setPartySearchResults([]);
      });

    return () => {
      isActive = false;
    };
  }, [debouncedPartyQuery, selectedParty]);

  useEffect(() => {
    function handleMouseDown(event) {
      const clickedTrigger = partyPickerRef.current?.contains(event.target);
      const clickedDropdown = partyDropdownRef.current?.contains(event.target);

      if (!clickedTrigger && !clickedDropdown) {
        setPartyDropdownOpen(false);
        setShowAddNew(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  useEffect(() => {
    if (!partyDropdownOpen || !partyQuery.trim() || selectedParty)
      return undefined;

    updatePartyDropdownPosition();
    window.addEventListener("resize", updatePartyDropdownPosition);
    window.addEventListener("scroll", updatePartyDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updatePartyDropdownPosition);
      window.removeEventListener("scroll", updatePartyDropdownPosition, true);
    };
  }, [
    partyDropdownOpen,
    partyQuery,
    selectedParty,
    updatePartyDropdownPosition,
  ]);

  useEffect(() => {
    api
      .listOrderAttributes({ entityType: "service" })
      .then((response) => {
        const items = Array.isArray(response)
          ? response
          : Array.isArray(response?.items)
            ? response.items
            : [];
        setAttributeDefs(items);
      })
      .catch(() => null);
  }, []);

  const chargeableItems = useMemo(
    () => items.filter((item) => !isPlaceholderItem(item)),
    [items],
  );

  // ── Totals ──
  const totals = useMemo(() => {
    const laborTotal =
      chargeableItems
        .filter((i) => i.itemType === "labor")
        .reduce((s, i) => s + Number(i.lineTotal || 0), 0) +
      activeJewelleryDetails.diamondChargeNumber;
    const partsTotal = chargeableItems
      .filter((i) => i.itemType === "part")
      .reduce((s, i) => s + Number(i.lineTotal || 0), 0);
    const subTotal = laborTotal + partsTotal;
    const taxTotal =
      chargeableItems.reduce(
        (sum, item) => sum + getVatAmount(item.lineTotal, item.taxRate),
        0,
      ) + activeJewelleryDetails.additionalTaxNumber;
    const preDiscountTotal = subTotal + taxTotal;
    const discountTotal = Math.min(
      Math.max(Number(discount || 0), 0),
      preDiscountTotal,
    );
    const grandTotal = Math.max(preDiscountTotal - discountTotal, 0);
    const received = isPaid
      ? grandTotal
      : Math.min(Number(amountReceived || 0), grandTotal);
    const due = Math.max(grandTotal - received, 0);
    return {
      laborTotal,
      partsTotal,
      subTotal,
      taxTotal,
      discountTotal,
      grandTotal,
      received,
      due,
      diamondCharge: activeJewelleryDetails.diamondChargeNumber,
      additionalTax: activeJewelleryDetails.additionalTaxNumber,
    };
  }, [
    activeJewelleryDetails.additionalTaxNumber,
    activeJewelleryDetails.diamondChargeNumber,
    amountReceived,
    chargeableItems,
    discount,
    isPaid,
  ]);

  const visibleItems = useMemo(
    () => items.filter((item) => !isPlaceholderItem(item)),
    [items],
  );

  const formSteps = useMemo(
    () => [
      { id: "details", label: t("services.detailStep") },
      { id: "items", label: t("services.itemsStep") },
      { id: "payment", label: t("services.paymentStep") },
    ],
    [t],
  );

  const mobileStepIndex = formSteps.findIndex((step) => step.id === mobileStep);
  const canGoBackStep = mobileStepIndex > 0;
  const canGoForwardStep =
    mobileStepIndex >= 0 && mobileStepIndex <= formSteps.length;

  useEffect(() => {
    if (isPaid) setAmountReceived(totals.grandTotal.toFixed(2));
  }, [isPaid, totals.grandTotal]);

  const applyQuickReceivedAmount = useCallback(
    (nextAmount, { markPaid = false } = {}) => {
      const normalizedAmount = Math.min(
        Math.max(Number(nextAmount || 0), 0),
        totals.grandTotal,
      );
      setIsPaid(markPaid && totals.grandTotal > 0);
      setAmountReceived(normalizedAmount.toFixed(2));
    },
    [totals.grandTotal],
  );

  useEffect(() => {
    if (!dialogOpen) return undefined;
    const node = formScrollRef.current;
    if (!node) return undefined;
    const frame = window.requestAnimationFrame(() => {
      node.scrollTo({ top: 0, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dialogOpen, mobileStep]);

  // ── Product helpers ──
  const getProductById = (id) => {
    if (id === null || id === undefined || id === "") return null;
    return productDirectory[String(id)] || null;
  };

  const cacheProducts = (entries) => {
    setProductDirectory((previous) => mergeLookupEntities(previous, entries));
  };

  const loadProductOptions = async (search) => {
    const data = await api.lookupProducts({ search, limit: 10 });
    const normalized = (data?.items || []).map(normalizeLookupProduct);
    cacheProducts(normalized);
    return normalized.map(toProductLookupOption);
  };

  const getUnitLabel = (product, unitType) => {
    if (!product) return "";
    return unitType === "secondary"
      ? product.secondaryUnit || product.primaryUnit || ""
      : product.primaryUnit || product.secondaryUnit || "";
  };

  const syncItemDefaults = (index, product, draft = false) => {
    if (!product) return;
    if (draft) {
      setItemDraft((prev) => {
        const next = { ...prev };
        if (!next.unitType) next.unitType = "primary";
        if (next.unitType === "secondary") {
          const explicit = Number(product.secondarySalePrice || 0);
          if (explicit > 0) {
            next.unitPrice = String(explicit);
          } else {
            const rate = Number(product.conversionRate || 0);
            const primary = Number(product.salePrice || 0);
            if (rate > 0 && primary > 0)
              next.unitPrice = String((primary / rate).toFixed(4));
          }
        } else if (
          next.unitType === "primary" &&
          Number(product.salePrice || 0) > 0
        ) {
          next.unitPrice = String(product.salePrice);
        }
        next.lineTotal = (
          Number(next.quantity || 0) * Number(next.unitPrice || 0)
        ).toFixed(2);
        return next;
      });
      return;
    }
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item };

        if (!next.unitType) next.unitType = "primary";
        if (next.unitType === "secondary") {
          const explicit = Number(product.secondarySalePrice || 0);
          if (explicit > 0) {
            next.unitPrice = String(explicit);
          } else {
            const rate = Number(product.conversionRate || 0);
            const primary = Number(product.salePrice || 0);
            if (rate > 0 && primary > 0)
              next.unitPrice = String((primary / rate).toFixed(4));
          }
        } else if (
          next.unitType === "primary" &&
          Number(product.salePrice || 0) > 0
        ) {
          next.unitPrice = String(product.salePrice);
        }
        next.lineTotal = (
          Number(next.quantity || 0) * Number(next.unitPrice || 0)
        ).toFixed(2);
        return next;
      }),
    );
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  const updateJewelleryAttribute = (key, value) => {
    setHeader((prev) => {
      const nextAttributes = {
        ...(prev.attributes || {}),
        [key]: value,
      };

      if (key === "metalType") {
        const nextPurityOptions = getPurityOptionsForMetal(value);
        if (
          nextPurityOptions.length > 0 &&
          !nextPurityOptions.includes(nextAttributes.metalPurity)
        ) {
          nextAttributes.metalPurity = "";
        }
      }

      return {
        ...prev,
        attributes: normalizeJewelleryAttributes(nextAttributes),
      };
    });
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, [field]: value };
        if (field === "itemType" && value === "labor") {
          next.productId = "";
          next.unitType = "primary";
        }
        next.lineTotal = (
          Number(next.quantity || 0) * Number(next.unitPrice || 0)
        ).toFixed(2);
        return next;
      }),
    );
    if (field === "productId" || field === "unitType") {
      const productId = field === "productId" ? value : items[index]?.productId;
      const product = getProductById(productId);
      if (product) syncItemDefaults(index, product);
    }
  };

  const removeItem = (index) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const handleDraftProductSelection = (option) => {
    const product = option?.entity
      ? normalizeLookupProduct(option.entity)
      : null;

    if (product?.id) {
      cacheProducts([product]);
    }

    setItemDraft((previous) => ({
      ...previous,
      productId: option?.value || "",
      taxRate: String(product?.taxRate || 0),
      actualUnit: "",
    }));

    if (product) {
      syncItemDefaults(null, product, true);
      // Auto-focus quantity input after product selection
      setTimeout(() => {
        quantityInputRef.current?.focus();
        quantityInputRef.current?.select();
      }, 100);
    }
  };

  // ── Item draft helpers ──
  const handleDraftChange = (field, value, actualUnit) => {
    // unitType change needs to re-price from product immediately
    if (field === "unitType") {
      const product = getProductById(itemDraft.productId);
      setItemDraft((prev) => {
        const next = { ...prev, unitType: value };
        if (product) {
          if (value === "secondary") {
            const explicit = Number(product.secondarySalePrice || 0);
            if (explicit > 0) {
              next.unitPrice = String(explicit);
            } else {
              const rate = Number(product.conversionRate || 0);
              const primary = Number(product.salePrice || 0);
              if (rate > 0 && primary > 0)
                next.unitPrice = String((primary / rate).toFixed(4));
            }
          } else if (
            value === "primary" &&
            Number(product.salePrice || 0) > 0
          ) {
            next.unitPrice = String(product.salePrice);
          }
        }
        next.actualUnit = actualUnit;
        next.lineTotal = (
          Number(next.quantity || 0) * Number(next.unitPrice || 0)
        ).toFixed(2);
        return next;
      });
      return;
    }

    setItemDraft((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "itemType" && value === "labor") {
        next.productId = "";
        next.unitType = "primary";
        next.quantity = "1";
      }
      next.lineTotal = (
        Number(next.quantity || 0) * Number(next.unitPrice || 0)
      ).toFixed(2);
      return next;
    });
    if (field === "productId") {
      const product = getProductById(value);
      if (product) setTimeout(() => syncItemDefaults(null, product, true), 0);
    }
  };

  const startAddItem = () => {
    setFormNotice({ type: "", message: "" });
    setItemDraft({ ...emptyItem });
    setEditingItemIdx(null);
    setShowItemForm(true);
    setMobileStep("items");
  };

  const startEditItem = (idx) => {
    setFormNotice({ type: "", message: "" });
    setItemDraft({ ...items[idx] });
    setEditingItemIdx(idx);
    setShowItemForm(true);
    setMobileStep("items");
  };

  const cancelItemForm = () => {
    setShowItemForm(false);
    setEditingItemIdx(null);
    setItemDraft({ ...emptyItem });
  };

  const confirmItem = () => {
    if (itemDraft.itemType === "part" && !itemDraft.productId) {
      setFormNotice({ type: "error", message: t("errors.selectProductPart") });
      return;
    }

    if (
      itemDraft.itemType === "part" &&
      itemDraft.unitType === "secondary" &&
      Number(getProductById(itemDraft.productId)?.conversionRate || 0) <= 0
    ) {
      setFormNotice({ type: "error", message: t("errors.conversionRequired") });
      return;
    }

    if (itemDraft.itemType === "part") {
      const product = getProductById(itemDraft.productId);
      const requestedQty = Number(itemDraft.quantity || 0);
      const available = toAvailableUnitQuantity(
        product,
        itemDraft.unitType || "primary",
        product,
      );
      if (requestedQty > available) {
        setFormNotice({
          type: "error",
          message: isAllStockExpired(product)
            ? t("sales.allStockExpiredNamed", { name: product?.name })
            : t("sales.insufficientStock"),
        });
        return;
      }
    }

    const draft = {
      ...itemDraft,
      lineTotal: (
        Number(itemDraft.quantity || 0) * Number(itemDraft.unitPrice || 0)
      ).toFixed(2),
    };
    if (editingItemIdx !== null) {
      setItems((prev) =>
        prev.map((item, idx) => (idx === editingItemIdx ? draft : item)),
      );
    } else {
      setItems((prev) => [...prev, draft]);
    }
    setFormNotice({ type: "", message: "" });
    setShowItemForm(false);
    setEditingItemIdx(null);
    setItemDraft({ ...emptyItem });
  };

  // ── Party helpers ──
  const filteredParties = useMemo(() => {
    return partySearchResults.slice(0, 6);
  }, [partySearchResults]);
  const selectedPartyBalanceMeta = getPartyBalanceMeta(
    selectedParty?.currentAmount,
    t,
  );
  const selectedPartyHasBalance =
    selectedParty?.currentAmount !== undefined &&
    selectedParty?.currentAmount !== null;
  const selectedPartyHasDue =
    selectedPartyHasBalance && selectedPartyBalanceMeta.absoluteAmount > 0;
  const selectedPartyWhatsAppMessage = getDueWhatsAppMessage(
    selectedParty?.name,
    selectedPartyHasDue
      ? t("currency.formatted", {
          symbol: t("currency.symbol"),
          amount: selectedPartyBalanceMeta.absoluteAmount.toFixed(2),
        })
      : "",
  );
  const selectedPartyWhatsAppLink = getWhatsAppLink(
    selectedParty?.phone,
    selectedPartyWhatsAppMessage,
  );
  const createPartyRequestRef = useRef(false);

  const selectParty = (party) => {
    setSelectedParty(party);
    setHeader((prev) => ({ ...prev, partyId: party.id }));
    setPartyQuery(`${party.name}${party.phone ? ` (${party.phone})` : ""}`);
    setPartyDropdownOpen(false);
    setShowAddNew(false);
    setNewPartyPhone("");
    setPartySearchResults([]);
  };

  const clearParty = () => {
    setSelectedParty(null);
    setHeader((prev) => ({ ...prev, partyId: "" }));
    setPartyQuery("");
    setPartyDropdownOpen(false);
    setShowAddNew(false);
    setNewPartyPhone("");
    setPartySearchResults([]);
  };

  const handlePartySearch = (e) => {
    setPartyQuery(e.target.value);
    setPartyDropdownOpen(true);
    setShowAddNew(false);
    if (selectedParty) {
      setSelectedParty(null);
      setHeader((prev) => ({ ...prev, partyId: "" }));
    }
  };

  const createAndSelectParty = async () => {
    if (createPartyRequestRef.current) return;

    const name = partyQuery
      .trim()
      .replace(/\s*\(.*\)\s*$/, "")
      .trim();
    if (!name) {
      setFormNotice({ type: "error", message: t("errors.customerRequired") });
      return;
    }
    const phoneDigits = newPartyPhone.trim().replace(/\D/g, "");
    if (phoneDigits && phoneDigits.length < 10) {
      setFormNotice({ type: "error", message: t("errors.phoneMinDigits") });
      return;
    }

    createPartyRequestRef.current = true;
    setCreatingParty(true);
    setFormNotice({ type: "", message: "" });

    try {
      const createdParty = await api.createParty({
        name,
        phone: newPartyPhone.trim(),
        type: "customer",
      });
      const party = normalizeLookupParty(createdParty);
      upsertParty(party);
      selectParty(party);
      setFormNotice({
        type: "success",
        message: t("parties.messages.created"),
      });
    } catch (err) {
      setFormNotice({ type: "error", message: err.message });
    } finally {
      createPartyRequestRef.current = false;
      setCreatingParty(false);
    }
  };

  // ── Reset & open/close dialog ──
  const resetForm = () => {
    setHeader({ ...makeEmptyHeader(), orderNo: "" });
    setHasDeliveryDate(true);
    setItems([]);
    setDiscount("0");
    setPartyQuery("");
    setSelectedParty(null);
    setPartyDropdownOpen(false);
    setShowAddNew(false);
    setNewPartyPhone("");
    setAmountReceived("0");
    setIsPaid(false);
    setStoreType("physical");
    setStoreDropdownOpen(false);
    setFormNotice({ type: "", message: "" });
    setEditingId(null);
    setShowItemForm(false);
    setItemDraft({ ...emptyItem });
    setEditingItemIdx(null);
    setSuggestedOrderNo("");
    setProductDirectory({});
    setMobileStep("details");
  };

  const loadVacantTables = async (currentTableId = '') => {
    try {
      const data = await api.getTables({ status: 'vacant', isActive: 'true', limit: 100 });
      let items = data?.items || [];
      if (currentTableId && !items.some(t => t.id === currentTableId)) {
        try {
          const currentTable = await api.getTable(currentTableId);
          if (currentTable) {
            items = [currentTable, ...items];
          }
        } catch (e) {
          console.warn('Failed to fetch current table details', e);
        }
      }
      setVacantTables(items);
    } catch (err) {
      console.error('Failed to load vacant tables', err);
    }
  };

  const openDialog = async () => {
    if (!canManageServices) return;
    resetForm();
    setDialogOpen(true);

    if (businessId) {
      loadVacantTables();
      try {
        const data = await api.getNextSequences();
        setSuggestedOrderNo(data?.nextServiceOrderNo || "");
      } catch {
        setSuggestedOrderNo("");
      }
    }
  };

  useEffect(() => {
    if (searchParams.get("create") !== "1") {
      createIntentHandledRef.current = false;
      return;
    }

    if (createIntentHandledRef.current) return;
    createIntentHandledRef.current = true;
    openDialog();

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  }, [openDialog, searchParams, setSearchParams]);

  const openEditDialog = async (order) => {
    if (!canManageServices) return;
    if (isIrdLocked(order) || isIrdCancelled(order)) {
      setListNotice({
        type: "error",
        message: t("services.messages.lockedEditBlocked"),
      });
      return;
    }
    resetForm();
    setEditingId(order.id);
    setDialogOpen(true);
    setEditLoading(true);
    try {
      const full = normalizeServiceOrder(await api.getService(order.id));
      const rawItems = full.items || [];
      const hydratedProducts = rawItems
        .map((item) => normalizeLookupProduct(item))
        .filter((product) => product.id);

      // Build party object from all possible sources
      const partyData = {
        partyId: full.partyId || full.Party?.id || full.Customer?.id || "",
        partyName:
          full.partyName || full.Party?.name || full.Customer?.name || "",
        partyPhone:
          full.partyPhone || full.Party?.phone || full.Customer?.phone || "",
        currentAmount:
          full.Party?.currentAmount ?? full.Customer?.currentAmount ?? null,
        type: "customer",
      };

      const currentTableId = full.tableId || full.Table?.id || full.table?.id || "";
      loadVacantTables(currentTableId);

      setHeader({
        partyId: full.partyId || "",
        orderNo: full.orderNo || "",
        status: full.status || "open",
        notes: full.notes || "",
        deliveryDate: toDateInputValue(full.deliveryDate) || todayISODate(),
        ...normalizePaymentFields(full),
        attachment:
          normalizeAttachmentUrls(full.attachments, full.attachment)[0] || "",
        attachments: normalizeAttachmentUrls(full.attachments, full.attachment),
        attributes: normalizeJewelleryAttributes(full.attributes || {}),
        tableId: currentTableId,
      });
      setHasDeliveryDate(!!full.deliveryDate);
      cacheProducts(hydratedProducts);
      setSuggestedOrderNo(full.orderNo || "");
      setAmountReceived(String(full.receivedTotal ?? 0));
      setDiscount(String(full.discountTotal ?? full.discount ?? 0));
      const computedIsPaid =
        Math.max(
          Number(full.grandTotal || 0) - Number(full.receivedTotal || 0),
          0,
        ) <= 0;
      setIsPaid(computedIsPaid);
      const savedStoreType = full.storeType || "physical";
      setStoreType(savedStoreType);
      setItems(
        rawItems.length > 0
          ? rawItems.map((i) => ({
              itemType: i.itemType || "labor",
              description: i.description || "",
              productId: i.productId || "",
              quantity: String(i.quantity ?? "1"),
              unitType: i.unitType || "primary",
              unitPrice: String(i.unitPrice ?? "0"),
              taxRate: String(i.taxRate ?? "0"),
              lineTotal: String(i.lineTotal ?? "0"),
            }))
          : [],
      );

      // Set selected party if we have party data
      if (partyData.partyId && partyData.partyName) {
        const party = normalizeLookupParty(partyData);
        setSelectedParty(party);
        setPartyQuery(`${party.name}${party.phone ? ` (${party.phone})` : ""}`);
      }
    } catch (err) {
      setFormNotice({ type: "error", message: err.message });
    } finally {
      setEditLoading(false);
    }
  };
  const closeDialog = () => {
    resetForm();
    setDialogOpen(false);
  };

  const goToNextMobileStep = () => {
    if (!canGoForwardStep) return;
    setMobileStep(formSteps[mobileStepIndex + 1]?.id);
  };

  const goToPreviousMobileStep = () => {
    if (!canGoBackStep) return;
    setMobileStep(formSteps[mobileStepIndex - 1]?.id);
  };

  const handlePartyFilterChange = (option) => {
    setPartyFilterId(option?.value || "");
    setSelectedPartyFilterOption(option || null);
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canManageServices) {
      setFormNotice({
        type: "error",
        message: t("staffManagement.permissionError"),
      });
      return;
    }
    if (!businessId) {
      setFormNotice({ type: "error", message: t("errors.businessIdRequired") });
      return;
    }
    // Customer is optional for services (walk-in support)
    const invalidPart = chargeableItems.find(
      (i) => i.itemType === "part" && !i.productId,
    );
    if (invalidPart) {
      setFormNotice({ type: "error", message: t("errors.selectProductPart") });
      return;
    }
    const invalidConversion = chargeableItems.find((i) => {
      if (i.itemType !== "part" || i.unitType !== "secondary") return false;
      return Number(getProductById(i.productId)?.conversionRate || 0) <= 0;
    });
    if (invalidConversion) {
      setFormNotice({ type: "error", message: t("errors.conversionRequired") });
      return;
    }
    if (!editingId) {
      const expiredPart = chargeableItems.find((item) => {
        if (item.itemType !== "part" || !item.productId) return false;
        const product = getProductById(item.productId);
        const available = toAvailableUnitQuantity(
          product,
          item.unitType || "primary",
          product,
        );
        return Number(item.quantity || 0) > available;
      });
      if (expiredPart) {
        const product = getProductById(expiredPart.productId);
        setFormNotice({
          type: "error",
          message: isAllStockExpired(product)
            ? t("sales.allStockExpiredNamed", { name: product?.name })
            : t("sales.insufficientStock"),
        });
        return;
      }
    }
    if (!chargeableItems.length) {
      setFormNotice({ type: "error", message: t("services.addFirstItem") });
      try {
        clearTimeout(formNoticeTimerRef.current);
        formNoticeTimerRef.current = setTimeout(() => {
          try {
            setFormNotice({ type: "", message: "" });
          } catch (err) {
            console.error("Error clearing notice:", err);
          }
        }, 2000);
      } catch (err) {
        console.error("Error setting timeout:", err);
      }
      return;
    }
    if (Number(discount || 0) < 0) {
      setFormNotice({ type: "error", message: t("services.discountInvalid") });
      return;
    }
    const normalizedAttributes = showGoldJewelleryDetails
      ? normalizeJewelleryAttributes(header.attributes)
      : Object.fromEntries(
          Object.entries(header.attributes || {}).filter(
            ([key]) => !JEWELLERY_ATTRIBUTE_KEYS.includes(key),
          ),
        );
    const wastagePercent = Number(normalizedAttributes.wastagePercent || 0);
    if (
      showGoldJewelleryDetails &&
      normalizedAttributes.wastagePercent &&
      (wastagePercent < 5 || wastagePercent > 15)
    ) {
      setFormNotice({
        type: "error",
        message: "Wastage percent must be between 5 and 15.",
      });
      return;
    }
    const receivedAmount = isPaid
      ? Number(totals.grandTotal || 0)
      : Number(amountReceived || 0);

    if (requiresBankSelection(header, receivedAmount)) {
      setMobileStep("payment");
      setFormNotice({
        type: "error",
        message: t("payments.bankRequired"),
      });

      clearTimeout(formNoticeTimerRef.current);

      formNoticeTimerRef.current = setTimeout(() => {
        setFormNotice({
          type: "",
          message: "",
        });
      }, 2000);

      return;
    }
    try {
      const manualOrderNo = String(header.orderNo || "").trim();
      const { paymentMethod, bankId, paymentNote, ...headerFields } = header;
      const attachmentUrls = normalizeAttachmentUrls(
        header.attachments,
        header.attachment,
      );
      const payload = {
        ...headerFields,
        deliveryDate: hasDeliveryDate ? (header.deliveryDate || todayISODate()) : null,
        tableId: header.tableId || null,
        storeType,
        attributes: normalizedAttributes,
        attachments: attachmentUrls,
        ...(attachmentUrls[0] ? { attachment: attachmentUrls[0] } : {}),
        laborTotal: totals.laborTotal,
        partsTotal: totals.partsTotal,
        subTotal: totals.subTotal,
        taxTotal: totals.taxTotal,
        discount: totals.discountTotal,
        discountTotal: totals.discountTotal,
        grandTotal: totals.grandTotal,
        receivedTotal: totals.received,
        ...buildPaymentPayload(
          { paymentMethod, bankId, paymentNote },
          { includeEmptyBankId: true },
        ),
        items: chargeableItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitType: item.unitType || "primary",
          conversionRate: Number(
            getProductById(item.productId)?.conversionRate || 0,
          ),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate),
          lineTotal: Number(item.lineTotal),
        })),
      };
      if (irdModeEnabled && !editingId) {
        delete payload.orderNo;
      } else if (manualOrderNo) {
        payload.orderNo = manualOrderNo;
      } else {
        delete payload.orderNo;
      }
      if (editingId) {
        await api.updateService(editingId, payload);
      } else {
        const creatorValue = getCurrentCreatorValue(user);
        const created = await api.createService({
          ...payload,
          ...(creatorValue ? { createdBy: creatorValue } : {}),
        });
        setSuggestedOrderNo(created?.orderNo || "");
      }
      useProductStore.getState().invalidate();
      closeDialog();
      loadServices();
    } catch (err) {
      setFormNotice({ type: "error", message: getStockAvailabilityMessage(err, t) });
    }
  };

  // ── Paged service list ──
  const filteredServiceList = safeServiceList;
  const pagedServices = filteredServiceList;

  // Service stats are now loaded directly from the backend API stats endpoint

  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: t("services.allStatuses") },
      { value: "in_progress", label: t("services.inProgress") },
      { value: "closed", label: t("services.closed") },
    ],
    [t],
  );

  // ── Status dialog ──
  const openStatusDialog = (order) => {
    if (!canManageServices) return;
    if (isIrdCancelled(order)) return;
    setStatusDialog(order);
    setNewStatus(order.status || "open");
    setStatusError("");
  };
  const closeStatusDialog = () => setStatusDialog(null);

  const openInvoiceModal = async (order, options = {}) => {
    setIsThermalInvoice(options.thermal === true);
    setInvoiceOrder(normalizeServiceOrder(order));
    setInvoiceLoading(true);
    try {
      const full = normalizeServiceOrder(await api.getService(order.id));
      setInvoiceOrder(full);
    } catch (_) {
      // use list data if full fetch fails
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!canManageServices) return;
    if (!statusDialog) return;
    try {
      await api.updateService(statusDialog.id, { status: newStatus });
      closeStatusDialog();
      loadServices();
    } catch (err) {
      setStatusError(err.message);
    }
  };

  // ── Record payment ──
  const openPayDialog = (order) => {
    if (!canManageServices) return;
    if (isIrdCancelled(order)) return;
    setPayDialog(order);
    setPayAmount("");
    setPayNotes("");
    setPayPaymentMethod("cash");
    setPayBankId("");
    setPayError("");
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!canManageServices) {
      setPayError(t("staffManagement.permissionError"));
      return;
    }
    const amount = Number(payAmount || 0);
    if (!amount || amount <= 0) {
      setPayError("Enter a valid amount.");
      return;
    }
    if (
      requiresBankSelection(
        { paymentMethod: payPaymentMethod, bankId: payBankId },
        amount,
      )
    ) {
      setPayError(t("payments.bankRequired"));
      return;
    }
    const currentDue = Math.max(
      Number(payDialog.grandTotal || 0) - Number(payDialog.receivedTotal || 0),
      0,
    );
    if (amount > currentDue) {
      setPayError(`Amount cannot exceed due of ${currentDue.toFixed(2)}.`);
      return;
    }
    try {
      const newReceived = Number(payDialog.receivedTotal || 0) + amount;
      await api.updateService(payDialog.id, {
        receivedTotal: newReceived,
        ...buildPaymentPayload(
          {
            paymentMethod: payPaymentMethod,
            bankId: payBankId,
            paymentNote: payNotes,
          },
          { includeEmptyBankId: true },
        ),
      });
      const refreshedOrder = normalizeServiceOrder(
        await api.getService(payDialog.id),
      );
      patchService(payDialog.id, refreshedOrder);
      if (invoiceOrder?.id === refreshedOrder.id) {
        setInvoiceOrder(refreshedOrder);
      }
      const refreshedParty = normalizeLookupParty({
        partyId:
          refreshedOrder.partyId ||
          refreshedOrder.Party?.id ||
          refreshedOrder.Customer?.id ||
          "",
        partyName:
          refreshedOrder.partyName ||
          refreshedOrder.Party?.name ||
          refreshedOrder.Customer?.name ||
          "",
        partyPhone:
          refreshedOrder.partyPhone ||
          refreshedOrder.Party?.phone ||
          refreshedOrder.Customer?.phone ||
          "",
        currentAmount:
          refreshedOrder.Party?.currentAmount ??
          refreshedOrder.Customer?.currentAmount ??
          null,
        type: "customer",
      });
      if (refreshedParty.id) {
        upsertParty(refreshedParty);
        if (selectedParty?.id === refreshedParty.id) {
          setSelectedParty(refreshedParty);
        }
      }
      setPayDialog(null);
      await loadServices();
    } catch (err) {
      setPayError(err.message);
    }
  };

  const closeDeleteDialog = () => {
    if (deleteService && deletingServiceId === deleteService.id) return;
    setDeleteService(null);
  };

  const closeCancelDialog = () => {
    if (cancelService && cancellingServiceId === cancelService.id) return;
    setCancelService(null);
    setCancelReason("");
  };

  const handleDeleteService = async () => {
    if (!canManageServices) return;
    if (!deleteService) return;

    setDeletingServiceId(deleteService.id);
    setListNotice({ type: "", message: "" });

    try {
      await api.deleteService(deleteService.id);
      useProductStore.getState().invalidate();
      setListError("");
      setListNotice({
        type: "success",
        message: t("services.messages.deleted"),
      });
      if (pagedServices.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      }
      await loadServices();
    } catch (err) {
      setListNotice({
        type: "error",
        message: err.message || t("services.messages.deleteFailed"),
      });
    } finally {
      setDeletingServiceId("");
      setDeleteService(null);
    }
  };

  const handleCancelService = async () => {
    if (!canManageServices || !cancelService) return;
    if (cancellingServiceId === cancelService.id) return;

    const reason = cancelReason.trim();
    if (!reason) {
      setListNotice({
        type: "error",
        message: t("services.cancelReasonRequired"),
      });
      return;
    }

    setCancellingServiceId(cancelService.id);
    setListNotice({ type: "", message: "" });
    try {
      await api.cancelService(cancelService.id, { reason });
      useProductStore.getState().invalidate();
      setListNotice({
        type: "success",
        message: t("services.messages.cancelled"),
      });
      await loadServices();
      setCancelService(null);
      setCancelReason("");
    } catch (err) {
      setListNotice({
        type: "error",
        message: err.message || t("services.messages.cancelFailed"),
      });
    } finally {
      setCancellingServiceId("");
    }
  };

  const money = (val) =>
    t("currency.formatted", {
      symbol: t("currency.symbol"),
      amount: Number(val || 0).toFixed(2),
    }).replace(" ", "\u00a0");

  const formScrollRef = useRef(null);
  const invoicePrintRef = useRef(null);

  const handlePrint = async () => {
    printElement(invoicePrintRef.current);
    await trackServiceReprint();
  };

  const handlePrintThermal = async () => {
    printThermalReceipt(thermalInvoicePrintRef.current);
    await trackServiceReprint();
  };

  const trackServiceReprint = async () => {
    if (!invoiceOrder?.id || !isIrdLocked(invoiceOrder)) return;
    try {
      const updated = normalizeServiceOrder(
        await api.recordServiceReprint(invoiceOrder.id),
      );
      setInvoiceOrder(updated);
      patchService(updated.id, updated);
    } catch {
      // Printing already happened; tracking failure should not block the user.
    }
  };

  const invoiceReprintLabel = getIrdReprintLabel(invoiceOrder);

  const buildServiceActions = (order) => {
    const locked = isIrdLocked(order);
    const cancelled = isIrdCancelled(order);
    const actions = [];

    if (canManageServices && !locked && !cancelled) {
      actions.push({
        label: t("common.edit"),
        icon: Pencil,
        onClick: () => openEditDialog(order),
      });
    }

    actions.push(
      {
        label: "View Bill",
        icon: FileText,
        onClick: () => openInvoiceModal(order),
      },
      {
        label: "Print Bill",
        icon: Printer,
        onClick: () => openInvoiceModal(order, { print: true }),
      },
      {
        label: "Print Thermal",
        icon: Printer,
        onClick: () => openInvoiceModal(order, { print: true, thermal: true }),
      },
    );

    if (canManageServices && locked && !cancelled) {
      actions.push({
        label: t("services.cancelInvoice"),
        icon: Ban,
        tone: "danger",
        disabled: cancellingServiceId === order.id,
        onClick: () => {
          setCancelReason("");
          setCancelService(order);
        },
      });
    }

    if (canManageServices && !locked && !cancelled) {
      actions.push({
        label: t("common.delete"),
        icon: Trash2,
        tone: "danger",
        disabled: deletingServiceId === order.id,
        onClick: () => setDeleteService(order),
      });
    }

    return actions;
  };

  const showDetailsStep = mobileStep === "details";
  const showItemsStep = mobileStep === "items";
  const showPaymentStep = mobileStep === "payment";
  const itemDraftProduct = getProductById(itemDraft.productId);
  const itemDraftVatAmount = getVatAmount(
    itemDraft.lineTotal,
    itemDraft.taxRate,
  );
  const canSaveDraftItem =
    itemDraft.itemType === "part"
      ? Boolean(itemDraft.productId) && Number(itemDraft.lineTotal || 0) > 0
      : Number(itemDraft.lineTotal || 0) > 0 ||
        Boolean(String(itemDraft.description || "").trim());
  const dialogTitle = editingId ? t("services.editOrder") : newOrderLabel;
  const summaryOrderNo = header.orderNo || suggestedOrderNo || "—";
  const invoiceAttachmentUrls = invoiceOrder
    ? getServiceAttachmentUrls(invoiceOrder)
    : [];
  const invoiceItems = invoiceOrder ? getServiceItems(invoiceOrder) : [];
  const invoiceJewellery = invoiceOrder
    ? getJewelleryBreakdown(invoiceOrder.attributes || {})
    : getJewelleryBreakdown({});
  const invoiceExtraAttributes = invoiceOrder?.attributes
    ? Object.entries(invoiceOrder.attributes).filter(
        ([key]) => !JEWELLERY_ATTRIBUTE_KEYS.includes(key),
      )
    : [];
  const invoiceTotals = invoiceOrder
    ? getServiceOrderTotals(invoiceOrder)
    : { laborTotal: 0, partsTotal: 0, subTotal: 0, taxTotal: 0, grandTotal: 0 };
  const mobilePrimaryActionLabel = canGoForwardStep
    ? t("common.continue")
    : editingId
      ? t("common.update")
      : t("services.saveOrder");
  const renderStoreTypeDropdown = () => (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setStoreDropdownOpen((o) => !o)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-[24px] border border-secondary-200/70 bg-white px-3 py-3 text-sm font-medium text-ink-light dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-200"
      >
        <selectedStore.icon size={15} />
        {selectedStore.value === "physical" ? "Physical" : "Online"}
        <ChevronDown
          size={13}
          className={`text-secondary-400 transition-transform ${storeDropdownOpen ? "rotate-180" : ""}`}
        />
      </button>

      {storeDropdownOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-44 overflow-hidden rounded-2xl border border-secondary-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900">
          {storeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setStoreType(opt.value);
                setStoreDropdownOpen(false);
              }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-mist dark:hover:bg-slate-800"
            >
              <opt.icon size={15} className="shrink-0 text-secondary-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-ink dark:text-slate-200">
                  {opt.label}
                </p>
                <p className="text-[11px] text-secondary-400">{opt.sub}</p>
              </div>
              {storeType === opt.value && (
                <Check size={13} className="shrink-0 text-emerald-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (!servicesEnabled) {
    return (
      <div className="space-y-6">
        <Notice
          title="This business type does not use the service workflow."
          description="Switch to the sales/POS flow for billing, or change the business type if this workspace should track repairs."
          tone="warn"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ServiceOrderList
        t={t}
        money={money}
        servicesTitle={servicesTitle}
        servicesSubtitle={servicesSubtitle}
        canManageServices={canManageServices}
        openDialog={openDialog}
        newOrderLabel={newOrderLabel}
        stats={stats}
        statsLoading={statsLoading}
        listNotice={listNotice}
        listError={listError}
        partyFilterId={partyFilterId}
        selectedPartyFilterOption={selectedPartyFilterOption}
        handlePartyFilterChange={handlePartyFilterChange}
        createdByFilterId={createdByFilterId}
        setCreatedByFilterId={setCreatedByFilterId}
        storeTypeFilter={storeTypeFilter}
        setStoreTypeFilter={setStoreTypeFilter}
        refreshingServices={refreshingServices}
        refreshServices={refreshServices}
        statusFilterOptions={statusFilterOptions}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        listLoading={listLoading}
        safeServiceList={safeServiceList}
        pagedServices={pagedServices}
        isGym={isGym}
        openStatusDialog={openStatusDialog}
        openPayDialog={openPayDialog}
        openLightbox={openLightbox}
        buildServiceActions={buildServiceActions}
        page={page}
        pageSize={pageSize}
        serviceTotal={serviceTotal}
        serviceTotalKnown={serviceTotalKnown}
        setPage={setPage}
        setPageSize={setPageSize}
      />

      <ServiceOrderFormDialog
        t={t}
        money={money}
        dialogOpen={dialogOpen}
        closeDialog={closeDialog}
        dialogTitle={dialogTitle}
        formNotice={formNotice}
        editLoading={editLoading}
        formScrollRef={formScrollRef}
        handleSubmit={handleSubmit}
        showDetailsStep={showDetailsStep}
        showItemsStep={showItemsStep}
        showPaymentStep={showPaymentStep}
        mobileStep={mobileStep}
        setMobileStep={setMobileStep}
        formSteps={formSteps}
        mobileStepIndex={mobileStepIndex}
        canGoBackStep={canGoBackStep}
        canGoForwardStep={canGoForwardStep}
        goToNextMobileStep={goToNextMobileStep}
        goToPreviousMobileStep={goToPreviousMobileStep}
        mobilePrimaryActionLabel={mobilePrimaryActionLabel}
        selectedParty={selectedParty}
        selectedPartyBalanceMeta={selectedPartyBalanceMeta}
        selectedPartyHasBalance={selectedPartyHasBalance}
        selectedPartyHasDue={selectedPartyHasDue}
        selectedPartyWhatsAppLink={selectedPartyWhatsAppLink}
        clearParty={clearParty}
        partyPickerRef={partyPickerRef}
        partyDropdownRef={partyDropdownRef}
        partyQuery={partyQuery}
        handlePartySearch={handlePartySearch}
        partyDropdownOpen={partyDropdownOpen}
        setPartyDropdownOpen={setPartyDropdownOpen}
        partyDropdownStyle={partyDropdownStyle}
        filteredParties={filteredParties}
        selectParty={selectParty}
        showAddNew={showAddNew}
        setShowAddNew={setShowAddNew}
        newPartyPhone={newPartyPhone}
        setNewPartyPhone={setNewPartyPhone}
        creatingParty={creatingParty}
        createAndSelectParty={createAndSelectParty}
        renderStoreTypeDropdown={renderStoreTypeDropdown}
        header={header}
        setHeader={setHeader}
        handleHeaderChange={handleHeaderChange}
        hasDeliveryDate={hasDeliveryDate}
        setHasDeliveryDate={setHasDeliveryDate}
        vacantTables={vacantTables}
        suggestedOrderNo={suggestedOrderNo}
        summaryOrderNo={summaryOrderNo}
        jewelleryAttributes={jewelleryAttributes}
        jewelleryPurityOptions={jewelleryPurityOptions}
        updateJewelleryAttribute={updateJewelleryAttribute}
        showGoldJewelleryDetails={showGoldJewelleryDetails}
        isGym={isGym}
        irdModeEnabled={irdModeEnabled}
        businessProfile={businessProfile}
        visibleItems={visibleItems}
        startAddItem={startAddItem}
        startEditItem={startEditItem}
        removeItem={removeItem}
        showItemForm={showItemForm}
        itemDraft={itemDraft}
        handleDraftChange={handleDraftChange}
        handleDraftProductSelection={handleDraftProductSelection}
        loadProductOptions={loadProductOptions}
        getProductById={getProductById}
        getUnitLabel={getUnitLabel}
        itemDraftProduct={itemDraftProduct}
        itemDraftVatAmount={itemDraftVatAmount}
        canSaveDraftItem={canSaveDraftItem}
        confirmItem={confirmItem}
        cancelItemForm={cancelItemForm}
        quantityInputRef={quantityInputRef}
        descriptionInputRef={descriptionInputRef}
        editingItemIdx={editingItemIdx}
        editingId={editingId}
        totals={totals}
        discount={discount}
        setDiscount={setDiscount}
        amountReceived={amountReceived}
        setAmountReceived={setAmountReceived}
        isPaid={isPaid}
        setIsPaid={setIsPaid}
        applyQuickReceivedAmount={applyQuickReceivedAmount}
      />

      <ServiceAttachmentLightbox
        lightboxState={lightboxState}
        onClose={closeLightbox}
        onPrev={showPrev}
        onNext={showNext}
      />

      <ServiceInvoiceModal
        t={t}
        money={money}
        invoiceOrder={invoiceOrder}
        setInvoiceOrder={setInvoiceOrder}
        isThermalInvoice={isThermalInvoice}
        setIsThermalInvoice={setIsThermalInvoice}
        handlePrint={handlePrint}
        handlePrintThermal={handlePrintThermal}
        invoiceLoading={invoiceLoading}
        bizSettings={bizSettings}
        isGym={isGym}
        invoiceItems={invoiceItems}
        invoiceTotals={invoiceTotals}
        invoiceJewellery={invoiceJewellery}
        invoiceExtraAttributes={invoiceExtraAttributes}
        safeAttributeDefs={safeAttributeDefs}
        invoiceReprintLabel={invoiceReprintLabel}
        invoiceAttachmentUrls={invoiceAttachmentUrls}
        invoicePrintRef={invoicePrintRef}
        thermalInvoicePrintRef={thermalInvoicePrintRef}
        showGoldJewelleryDetails={showGoldJewelleryDetails}
        openLightbox={openLightbox}
      />

      {/* ── Status Update Modal ── */}
      {statusDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeStatusDialog();
          }}
        >
          <div className="w-full max-w-sm rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950 sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-secondary-200/70 px-6 py-4 dark:border-slate-800/70">
              <h2 className="font-serif text-xl text-ink">
                {t("services.updateStatus")}
              </h2>
              <button
                type="button"
                onClick={closeStatusDialog}
                className="rounded-xl p-2 text-secondary-400 hover:bg-secondary-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {statusError ? <Notice title={statusError} tone="error" /> : null}
              <div className="rounded-xl bg-mist px-4 py-3 text-sm dark:bg-slate-900/60">
                <p className="font-semibold text-ink dark:text-slate-200">
                  {statusDialog.orderNo || statusDialog.id.slice(0, 8)}
                </p>
                {statusDialog.Party?.name ? (
                  <p className="text-secondary-500">{statusDialog.partyName}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                {STATUS_STEPS.map((step) => {
                  const isSelected = newStatus === step.value;
                  return (
                    <button
                      key={step.value}
                      type="button"
                      onClick={() => setNewStatus(step.value)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${isSelected ? step.selectedClass : "border-secondary-200 bg-white hover:border-secondary-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"}`}
                    >
                      <span
                        className={`h-3 w-3 shrink-0 rounded-full ${step.dotClass}`}
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-ink dark:text-slate-200">
                          {step.label}
                        </p>
                        <p className="text-xs text-secondary-500">{step.desc}</p>
                      </div>
                      {isSelected && (
                        <Check size={16} className={step.checkClass} />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={closeStatusDialog}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="btn-primary flex-1"
                  onClick={handleUpdateStatus}
                  disabled={newStatus === statusDialog.status}
                >
                  {t("services.updateStatus")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Dialog ── */}
      {payDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPayDialog(null);
          }}
        >
          <div className="w-full max-w-sm rounded-t-3xl bg-white shadow-2xl dark:bg-slate-950 sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-secondary-200/70 px-6 py-4 dark:border-slate-800/70">
              <h2 className="font-serif text-xl text-ink">
                {t("services.recordPayment")}
              </h2>
              <button
                type="button"
                onClick={() => setPayDialog(null)}
                className="rounded-xl p-2 text-secondary-400 hover:bg-secondary-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="space-y-4 p-6">
              {payError ? (
                <div className="space-y-3">
                  <Notice title={payError} tone="error" />
                  <button
                    type="button"
                    className="btn-secondary w-full sm:w-auto"
                    onClick={() => setPayError("")}
                  >
                    {t("common.back")}
                  </button>
                </div>
              ) : null}
              <div className="rounded-xl bg-mist p-3 text-sm dark:bg-slate-900/60">
                <p className="font-semibold text-ink dark:text-slate-200">
                  {payDialog.orderNo || payDialog.id.slice(0, 8)}
                </p>
                {payDialog.partyName ? (
                  <p className="text-secondary-500">{payDialog.partyName}</p>
                ) : null}
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-secondary-500">
                    Total: {money(payDialog.grandTotal)}
                  </span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {t("services.dueAmount")}:{" "}
                    {money(
                      Math.max(
                        Number(payDialog.grandTotal || 0) -
                          Number(payDialog.receivedTotal || 0),
                        0,
                      ),
                    )}
                  </span>
                </div>
              </div>
              <div>
                <label className="label">{t("services.amountReceived")}</label>
                <input
                  className="input mt-1"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div>
                <PaymentMethodFields
                  value={{
                    paymentMethod: payPaymentMethod,
                    bankId: payBankId,
                    paymentNote: payNotes,
                  }}
                  onChange={(patch) => {
                    setPayPaymentMethod(patch.paymentMethod);
                    setPayBankId(patch.bankId);
                    setPayNotes(patch.paymentNote);
                  }}
                  noteLabel={t("payments.paymentNote")}
                />
              </div>
              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={() => setPayDialog(null)}
                >
                  {t("common.cancel")}
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteService)}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteService}
        description={
          deleteService
            ? t("services.deleteConfirm", {
                name: deleteService.orderNo || deleteService.id.slice(0, 8),
              })
            : t("common.confirmDelete")
        }
        confirming={
          Boolean(deleteService) && deletingServiceId === deleteService.id
        }
      />

      <Dialog
        isOpen={Boolean(cancelService)}
        onClose={closeCancelDialog}
        title={t("services.cancelInvoice")}
        size="sm"
        showCloseButton={!(cancelService && cancellingServiceId === cancelService.id)}
        closeOnOverlayClick={!(cancelService && cancellingServiceId === cancelService.id)}
        footer={(
          <>
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={closeCancelDialog}
              disabled={Boolean(cancelService && cancellingServiceId === cancelService.id)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              onClick={handleCancelService}
              disabled={Boolean(cancelService && cancellingServiceId === cancelService.id)}
            >
              {cancelService && cancellingServiceId === cancelService.id
                ? t("common.loading")
                : t("services.confirmCancelInvoice")}
            </button>
          </>
        )}
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-secondary-700">
            {cancelService
              ? t("services.cancelConfirm", {
                  name: cancelService.orderNo || cancelService.id.slice(0, 8),
                })
              : ""}
          </p>
          <div className="space-y-1">
            <label className="label" htmlFor="service-cancel-reason">
              {t("services.cancelReason")}
            </label>
            <textarea
              id="service-cancel-reason"
              className="input min-h-[96px] resize-none"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder={t("services.cancelReasonPlaceholder")}
              disabled={Boolean(cancelService && cancellingServiceId === cancelService.id)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
