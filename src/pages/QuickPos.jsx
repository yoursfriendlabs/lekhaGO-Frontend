import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Coffee,
  Minus,
  Package2,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  Utensils,
  X,
  Truck,
} from "lucide-react";
import PageHeader from "../components/PageHeader.jsx";
import Notice from "../components/Notice.jsx";
import PaymentMethodFields from "../components/PaymentMethodFields.jsx";
import NoteTextarea from "../components/NoteTextarea.jsx";
import QuickPaymentButtons from "../components/QuickPaymentButtons.jsx";
import QuickPartySelector from "../components/QuickPartySelector.jsx";
import QuickActionSuccessDialog from "../components/QuickActionSuccessDialog.jsx";
import { Dialog } from "../components/ui/Dialog.tsx";
import MobileFormStepper from "../components/MobileFormStepper.jsx";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useBusinessSettings } from "../lib/businessSettings.jsx";
import { useI18n } from "../lib/i18n.jsx";
import { useSnackbar } from "../lib/snackbar.jsx";
import { formatCurrency } from "../lib/currency";
import { todayISODate } from "../lib/datetime";
import { normalizeLookupProduct } from "../lib/lookups.js";
import { buildPaymentPayload, requiresBankSelection } from "../lib/payments";
import { getCurrentCreatorValue } from "../lib/records";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { useSSEEvent, SSE_EVENTS } from "../hooks/useSSE.js";
import { useProductStore } from "../stores/products";
import { checkNewAndReadyOrders } from "../lib/cafeOrders.js";

function getProductCategoryName(product = {}) {
  if (typeof product.categoryName === "string" && product.categoryName.trim())
    return product.categoryName.trim();
  if (
    product.category &&
    typeof product.category === "object" &&
    typeof product.category.name === "string" &&
    product.category.name.trim()
  ) {
    return product.category.name.trim();
  }
  if (typeof product.category === "string" && product.category.trim())
    return product.category.trim();
  if (typeof product.companyName === "string" && product.companyName.trim())
    return product.companyName.trim();
  return "";
}

function normalizePosProduct(raw = {}) {
  const product = normalizeLookupProduct(raw);

  return {
    ...raw,
    ...product,
    id: product.id || String(raw.id || ""),
    name: product.name || raw.name || "Item",
    categoryName: getProductCategoryName(raw),
    taxRate: Number(raw.taxRate ?? product.taxRate ?? 0),
  };
}

function getItemInitials(name = "") {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "IT";

  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((chunk) => chunk[0] || "")
    .join("")
    .toUpperCase();
}

function getLineTaxAmount(item) {
  return (Number(item.lineTotal || 0) * Number(item.taxRate || 0)) / 100;
}

function formatStockLabel(product, unitType = "primary") {
  const quantity = getAvailableStockQuantity(product, unitType).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  );
  const unitLabel = getProductUnitLabel(product, unitType);

  return `${quantity} ${unitLabel}`.trim();
}

function getStockQuantity(product = {}) {
  return Number(
    product?.stockOnHand ??
      product?.openingStock ??
      product?.quantityOnHand ??
      0,
  );
}

function getConversionRate(product = {}) {
  return Number(product?.conversionRate || 0);
}

function getAvailableStockQuantity(
  product,
  unitType = "primary",
  fallback = {},
) {
  const stockOnHand = getStockQuantity(product) || getStockQuantity(fallback);
  const conversionRate =
    getConversionRate(product) || getConversionRate(fallback);
  const secondaryUnit = product?.secondaryUnit || fallback?.secondaryUnit || "";

  if (unitType === "secondary" && secondaryUnit && conversionRate > 0) {
    return stockOnHand * conversionRate;
  }

  return stockOnHand;
}

function getProductUnitLabel(product, unitType) {
  if (!product) return "";
  if (unitType === "secondary")
    return product.secondaryUnit || product.primaryUnit || "";
  return product.primaryUnit || product.secondaryUnit || "";
}

function deriveUnitPrice(product, unitType = "primary") {
  if (!product) return 0;
  if (unitType === "secondary") {
    const explicitSecondary = Number(product.secondarySalePrice || 0);
    if (explicitSecondary > 0) return explicitSecondary;
    const conversionRate = Number(product.conversionRate || 0);
    const primaryPrice = Number(product.salePrice || 0);
    if (conversionRate > 0 && primaryPrice > 0) {
      return Number((primaryPrice / conversionRate).toFixed(4));
    }
  }
  return Number(product.salePrice || product.sellingPrice || 0);
}

function buildCartItem(product, unitType = "primary") {
  const unitPrice = deriveUnitPrice(product, unitType);
  return {
    productId: product.id,
    name: product.name,
    categoryName: product.categoryName,
    quantity: 1,
    unitType,
    unitPrice,
    taxRate: Number(product.taxRate || 0),
    lineTotal: unitPrice.toFixed(2),
    primaryUnit: product.primaryUnit || "",
    secondaryUnit: product.secondaryUnit || "",
    conversionRate: Number(product.conversionRate || 0),
    secondarySalePrice: Number(product.secondarySalePrice || 0),
    salePrice: Number(product.salePrice || product.sellingPrice || 0),
    stockOnHand: Number(product.stockOnHand || 0),
  };
}

const emptyCheckoutForm = {
  saleDate: todayISODate(),
  invoiceNo: "",
  notes: "",
  discount: "0",
  amountReceived: "0",
  paymentMethod: "cash",
  bankId: "",
  paymentNote: "",
  tableId: "",
};

const MOBILE_PRODUCT_PAGE_SIZE = 9;
const MOBILE_PRODUCT_SCROLL_THRESHOLD = 120;

export default function QuickPos() {
  const [searchParams] = useSearchParams();
  const queryTableId = searchParams.get("tableId") || "";
  const queryRef = searchParams.get("ref") || "";
  const queryCheckout = searchParams.get("checkout") || "";

  const { t } = useI18n();
  const { showError } = useSnackbar();
  const { businessId, user } = useAuth();
  const { businessProfile } = useBusinessSettings();
  const isTablesEnabled = useMemo(() => {
    return businessProfile?.settings?.enabledModules?.includes("tables");
  }, [businessProfile]);
  const navigate = useNavigate();
  const isMobile = useIsMobile("(max-width: 1023px)");
  const { invalidate: invalidateProducts } = useProductStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: "info", message: "" });
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [partySelectorOpen, setPartySelectorOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState(emptyCheckoutForm);
  const [allTables, setAllTables] = useState([]);
  const [floors, setFloors] = useState([]);
  const [selectedFloorFilter, setSelectedFloorFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");
  const [activeTableId, setActiveTableId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [tableSelectorOpen, setTableSelectorOpen] = useState(false);
  const [activeSessionOption, setActiveSessionOption] = useState(() => {
    if (queryTableId) return "dine_in";
    return null;
  });
  const [deliveryFormOpen, setDeliveryFormOpen] = useState(false);
  const [deliveryFormState, setDeliveryFormState] = useState({
    customerName: "",
    customerPhone: "",
    location: "",
    notes: ""
  });

  const vacantTables = useMemo(() => allTables.filter((t) => t.status === "vacant"), [allTables]);

  const filteredTablesForSelector = useMemo(() => {
    return allTables.filter((table) => {
      if (selectedFloorFilter !== "all") {
        if (selectedFloorFilter === "unassigned") {
          if (table.categoryId || table.category?.id) return false;
        } else {
          const catId = table.categoryId || table.category?.id;
          if (String(catId) !== String(selectedFloorFilter)) return false;
        }
      }

      if (selectedStatusFilter !== "all") {
        const isOccupied = table.status === "occupied";
        if (selectedStatusFilter === "vacant" && isOccupied) return false;
        if (selectedStatusFilter === "occupied" && !isOccupied) return false;
      }

      return true;
    });
  }, [allTables, selectedFloorFilter, selectedStatusFilter]);
  const [showAmountReceivedInput, setShowAmountReceivedInput] = useState(false);
  const [suggestedInvoiceNo, setSuggestedInvoiceNo] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successState, setSuccessState] = useState(null);
  const [activeAttributes, setActiveAttributes] = useState({});
  const [mobileStep, setMobileStep] = useState("items");
  const [productUnitTypes, setProductUnitTypes] = useState({});
  const [visibleProductCount, setVisibleProductCount] = useState(
    MOBILE_PRODUCT_PAGE_SIZE,
  );
  const mobileProductScrollRef = useRef(null);
  const mobileProductLoadMoreRef = useRef(null);

  const formSteps = [
    { id: "items", label: t("Items") || "Items" },
    { id: "details", label: t("Checkout") || "Details" },
  ];

  const salesTitle =
    businessProfile?.type === "cafe"
      ? businessProfile?.salesFlow?.title || t("quickPos.title")
      : t("quickPos.title");

  const money = (value) =>
    formatCurrency(value, { symbol: t("currency.symbol") });
  const bankRequiredMessage = t("payments.bankRequired");
  const bankAccountError =
    status.type === "error" && status.message === bankRequiredMessage
      ? bankRequiredMessage
      : "";

  const handleCheckoutPaymentChange = (patch) => {
    setCheckoutForm((previous) => ({ ...previous, ...patch }));

    if ((patch.bankId || patch.paymentMethod === "cash") && bankAccountError) {
      setStatus({ type: "info", message: "" });
    }
  };

  const handleReviewBill = () => {
    if (!cart.length) {
      showError(t("sales.addFirstItem"));
      return;
    }

    if (!Number(checkoutForm.amountReceived || 0)) {
      setCheckoutForm((prev) => ({
        ...prev,
        amountReceived: totals.grandTotal.toFixed(2),
      }));
    }

    setCheckoutOpen(true);
  };

  useEffect(() => {
    if (!businessId) {
      setProducts([]);
      setAllTables([]);
      setFloors([]);
      setLoading(false);
      return;
    }

    let isActive = true;
    setLoading(true);
    setStatus({ type: "info", message: "" });

    Promise.all([
      api.listProducts({ limit: 500 }),
      api.getNextSequences().catch(() => null),
      api.getTables({ isActive: "true", limit: 100 }).catch(() => null),
      api.listCategories({ type: "table", limit: 100 }).catch(() => null),
    ])
      .then(([productResponse, sequenceResponse, tablesResponse, categoriesResponse]) => {
        if (!isActive) return;
        const normalizedProducts = (productResponse?.items || [])
          .map(normalizePosProduct)
          .filter((product) => product.id);

        setProducts(normalizedProducts);
        setSuggestedInvoiceNo(sequenceResponse?.nextSaleInvoiceNo || "");
        setAllTables(tablesResponse?.items || []);
        setFloors(categoriesResponse?.items || []);
      })
      .catch((error) => {
        if (!isActive) return;
        setProducts([]);
        setAllTables([]);
        setFloors([]);
        setStatus({ type: "error", message: error.message });
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [businessId]);

  const refreshRealtimeData = async () => {
    try {
      const [salesResponse, tablesResponse] = await Promise.all([
        api.listSales({ limit: 120 }).catch(() => ({ items: [] })),
        isTablesEnabled ? api.getTables({ isActive: "true", limit: 100 }).catch(() => null) : null
      ]);

      if (salesResponse?.items) {
        checkNewAndReadyOrders(salesResponse.items);
      }

      if (tablesResponse?.items) {
        setAllTables(tablesResponse.items);
      }
    } catch (err) {
      console.error("Failed to refresh real-time updates:", err);
    }
  };

  useSSEEvent(SSE_EVENTS.SALES_CHANGED, () => {
    refreshRealtimeData().catch(() => {});
  });

  useSSEEvent(SSE_EVENTS.TABLES_CHANGED, () => {
    refreshRealtimeData().catch(() => {});
  });

  // Polling for real-time table status and order ready notifications as fallback
  useEffect(() => {
    if (!businessId) return;

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const interval = setInterval(async () => {
      await refreshRealtimeData();
    }, 30000);

    return () => clearInterval(interval);
  }, [businessId, isTablesEnabled]);

  const handleSelectDelivery = () => {
    setActiveSessionOption("delivery");
    handleTableChange("");
    setTableSelectorOpen(false);

    setDeliveryFormState({
      customerName: activeAttributes?.customer_name || selectedParty?.name || "",
      customerPhone: activeAttributes?.customer_phone || selectedParty?.phone || "",
      location: activeAttributes?.customer_address || selectedParty?.address || "",
      notes: checkoutForm?.notes || ""
    });
    setDeliveryFormOpen(true);
  };

  const handleTableChange = async (tableId) => {
    setActiveTableId(tableId);
    setCheckoutForm((prev) => ({ ...prev, tableId }));

    if (!tableId) {
      ignoreAutoSaveRef.current = true;
      setCart([]);
      setEditingId(null);
      setCheckoutForm(emptyCheckoutForm);
      setDeletedItemIds([]);
      return;
    }

    setLoading(true);
    try {
      const activeSales = await api.listSales({ limit: 120 });
      const activeOrder = (activeSales?.items || []).find(
        (sale) =>
          String(sale.tableId) === String(tableId) && sale.status === "due",
      );

      if (activeOrder) {
        const fullSale = await api.getSale(activeOrder.id);
        const saleItems = fullSale?.SaleItems || [];

        const mappedCart = saleItems.map((item) => {
          const product = productsById[String(item.productId)];
          const uPrice = String(item.unitPrice || 0);
          return {
            id: item.id,
            productId: item.productId,
            name: product?.name || item.productName || "Unknown Product",
            categoryName: product?.categoryName || "",
            quantity: Number(item.quantity || 0),
            unitType: item.unitType || "primary",
            unitPrice: uPrice,
            taxRate: Number(item.taxRate || 0),
            lineTotal: Number(item.lineTotal || 0).toFixed(2),
            primaryUnit: product?.primaryUnit || "",
            secondaryUnit: product?.secondaryUnit || "",
            conversionRate: Number(
              item.conversionRate || product?.conversionRate || 0,
            ),
            secondarySalePrice: Number(product?.secondarySalePrice || 0),
            salePrice: Number(product?.salePrice || product?.sellingPrice || 0),
            stockOnHand: Number(product?.stockOnHand || 0),
          };
        });

        ignoreAutoSaveRef.current = true;
        setEditingId(activeOrder.id);
        setCart(mappedCart);
        setDeletedItemIds([]);

        setCheckoutForm({
          saleDate: fullSale.saleDate || todayISODate(),
          invoiceNo: fullSale.invoiceNo || "",
          notes: fullSale.notes || "",
          discount: String(fullSale.discount || 0),
          amountReceived: String(fullSale.amountReceived || 0),
          paymentMethod: fullSale.paymentMethod || "cash",
          bankId: fullSale.bankId || "",
          paymentNote: fullSale.paymentNote || "",
          tableId: String(tableId),
        });
        setActiveAttributes(fullSale?.attributes || {});
      } else {
        await api
          .updateTable(tableId, { status: "occupied" })
          .catch(() => null);
        ignoreAutoSaveRef.current = true;
        setCart([]);
        setEditingId(null);
        setDeletedItemIds([]);
        setCheckoutForm({
          ...emptyCheckoutForm,
          tableId: String(tableId),
        });
        setActiveAttributes({});
      }
    } catch (err) {
      showError(err.message || "Failed to load table orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessProfile) {
      const tablesEnabled =
        businessProfile?.settings?.enabledModules?.includes("tables");
      if (!tablesEnabled) {
        setActiveSessionOption("takeaway");
      }
    }
  }, [businessProfile]);

  useEffect(() => {
    if (queryTableId && allTables.length > 0 && products.length > 0) {
      handleTableChange(queryTableId).then(() => {
        if (queryCheckout === "1" || queryCheckout === "true") {
          setCheckoutOpen(true);
        }
      });
    }
  }, [queryTableId, allTables.length, products.length, queryCheckout]);

  const categoryOptions = useMemo(() => {
    const categories = [
      ...new Set(
        products.map((product) => product.categoryName).filter(Boolean),
      ),
    ];
    return ["all", ...categories];
  }, [products]);
  const quickCategoryOptions = useMemo(
    () => categoryOptions.slice(0, 7),
    [categoryOptions],
  );
  const productsById = useMemo(() => {
    const entries = products.map((product) => [String(product.id), product]);
    return Object.fromEntries(entries);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" || product.categoryName === selectedCategory;
      if (!matchesCategory) return false;
      if (!query) return true;

      const searchText = [
        product.name,
        product.companyName,
        product.categoryName,
        product.primaryUnit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchText.includes(query);
    });
  }, [products, search, selectedCategory]);

  useEffect(() => {
    setVisibleProductCount(
      isMobile ? MOBILE_PRODUCT_PAGE_SIZE : filteredProducts.length,
    );

    if (isMobile) {
      mobileProductScrollRef.current?.scrollTo({ top: 0 });
    }
  }, [filteredProducts.length, isMobile, search, selectedCategory]);

  const visibleProducts = useMemo(
    () =>
      isMobile
        ? filteredProducts.slice(0, visibleProductCount)
        : filteredProducts,
    [filteredProducts, isMobile, visibleProductCount],
  );

  const hasMoreMobileProducts =
    isMobile && visibleProductCount < filteredProducts.length;

  const loadMoreMobileProducts = () => {
    setVisibleProductCount((previous) =>
      Math.min(previous + MOBILE_PRODUCT_PAGE_SIZE, filteredProducts.length),
    );
  };

  const handleMobileProductScroll = (event) => {
    if (!hasMoreMobileProducts) return;

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (
      scrollHeight - scrollTop - clientHeight <=
      MOBILE_PRODUCT_SCROLL_THRESHOLD
    ) {
      loadMoreMobileProducts();
    }
  };

  useEffect(() => {
    if (
      !hasMoreMobileProducts ||
      !mobileProductLoadMoreRef.current ||
      typeof IntersectionObserver === "undefined"
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMoreMobileProducts();
      },
      {
        root: mobileProductScrollRef.current,
        rootMargin: "96px",
      },
    );

    observer.observe(mobileProductLoadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredProducts.length, hasMoreMobileProducts, visibleProductCount]);

  const totals = useMemo(() => {
    const subTotal = cart.reduce(
      (sum, item) => sum + Number(item.lineTotal || 0),
      0,
    );
    const lineTaxTotal = cart.reduce(
      (sum, item) => sum + getLineTaxAmount(item),
      0,
    );
    const headerTaxRate = Number(checkoutForm.taxRate || 0);
    const headerTaxTotal =
      headerTaxRate > 0 ? (subTotal * headerTaxRate) / 100 : 0;
    const taxTotal = lineTaxTotal + headerTaxTotal;
    const discountTotal = Math.min(
      Math.max(Number(checkoutForm.discount || 0), 0),
      subTotal + taxTotal,
    );
    const grandTotal = Math.max(subTotal + taxTotal - discountTotal, 0);

    return { subTotal, taxTotal, discountTotal, grandTotal };
  }, [cart, checkoutForm.discount, checkoutForm.taxRate]);

  const receivedAmount = useMemo(
    () => Math.min(Number(checkoutForm.amountReceived || 0), totals.grandTotal),
    [checkoutForm.amountReceived, totals.grandTotal],
  );
  const dueAmount = Math.max(totals.grandTotal - receivedAmount, 0);

  const changeAmount = useMemo(() => {
    const rawReceived = Number(checkoutForm.amountReceived || 0);
    return Math.max(rawReceived - totals.grandTotal, 0);
  }, [checkoutForm.amountReceived, totals.grandTotal]);

  const quickAmountOptions = useMemo(() => {
    const total = totals.grandTotal;
    const roundTotal = Math.ceil(total);
    const options = [{ label: t("common.exact") || "Exact", value: total }];

    [100, 500, 1000, 2000, 5000].forEach((denom) => {
      if (denom >= roundTotal && !options.some((o) => Math.abs(o.value - denom) < 0.01)) {
        options.push({ label: `${t("currency.symbol") || "Rs"} ${denom}`, value: denom });
      }
    });

    if (options.length === 1 && total > 0) {
      const next100 = Math.ceil(total / 100) * 100;
      const next500 = Math.ceil(total / 500) * 500;
      if (next100 > total) options.push({ label: `${t("currency.symbol") || "Rs"} ${next100}`, value: next100 });
      if (next500 > next100) options.push({ label: `${t("currency.symbol") || "Rs"} ${next500}`, value: next500 });
    }

    return options;
  }, [totals.grandTotal, t]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart],
  );

  const handleMobileStepChange = (step) => {
    setMobileStep(step);
    if (step === "details") {
      setCheckoutOpen(true);
    }
  };

  const handleCloseCheckout = () => {
    setCheckoutOpen(false);
    setMobileStep("items");
  };

  const goToNextMobileStep = () => {
    handleReviewBill();
  };

  const goToPreviousMobileStep = () => {
    handleCloseCheckout();
  };

  const getProductById = (productId) => productsById[String(productId)] || null;

  const ignoreAutoSaveRef = useRef(false);

  const submittingRef = useRef(submitting);
  const cartRef = useRef(cart);
  const editingIdRef = useRef(editingId);
  const activeTableIdRef = useRef(activeTableId);
  const checkoutFormRef = useRef(checkoutForm);
  const activeAttributesRef = useRef(activeAttributes);
  const selectedPartyRef = useRef(selectedParty);

  useEffect(() => {
    submittingRef.current = submitting;
    cartRef.current = cart;
    editingIdRef.current = editingId;
    activeTableIdRef.current = activeTableId;
    checkoutFormRef.current = checkoutForm;
    activeAttributesRef.current = activeAttributes;
    selectedPartyRef.current = selectedParty;
  });



  useEffect(() => {
    if (!isTablesEnabled || !activeTableId || loading) return;

    if (ignoreAutoSaveRef.current) {
      ignoreAutoSaveRef.current = false;
      return;
    }

    const delayDebounce = setTimeout(async () => {
      const currentSubmitting = submittingRef.current;
      const currentCart = cartRef.current;
      const currentEditingId = editingIdRef.current;
      const currentActiveTableId = activeTableIdRef.current;
      const currentCheckoutForm = checkoutFormRef.current;
      const currentActiveAttributes = activeAttributesRef.current;
      const currentSelectedParty = selectedPartyRef.current;

      if (currentSubmitting || !currentActiveTableId) return;

      try {
        if (currentCart.length === 0) {
          if (currentEditingId) {
            await api.deleteSale(currentEditingId);
            setEditingId(null);
            await api
              .updateTable(currentActiveTableId, { status: "vacant" })
              .catch(() => null);
          }
          return;
        }

        const matchedTable = allTables.find(
          (t) => String(t.id) === String(currentActiveTableId),
        );
        const resolvedTableNo = matchedTable ? matchedTable.name : "";

        const subTotal = currentCart.reduce(
          (sum, item) => sum + Number(item.lineTotal || 0),
          0,
        );
        const discountAmount = Math.max(
          Number(currentCheckoutForm.discount || 0),
          0,
        );
        const beforeTax = Math.max(subTotal - discountAmount, 0);
        const taxRate = Number(currentCheckoutForm.taxRate || 0);
        const taxTotal = (beforeTax * taxRate) / 100;
        const grandTotal = beforeTax + taxTotal;

        const payload = {
          saleDate: currentCheckoutForm.saleDate || todayISODate(),
          notes: currentCheckoutForm.notes || "",
          tableId: String(currentActiveTableId),
          status: "due",
          partyId: currentSelectedParty?.id || null,
          amountReceived: 0,
          paymentMethod: "cash",
          subTotal,
          taxTotal,
          discount: discountAmount,
          discountTotal: discountAmount,
          grandTotal,
          attributes: {
            ...(currentActiveAttributes || {}),
            order_status: currentActiveAttributes?.order_status || "new",
            order_type: activeSessionOption || currentActiveAttributes?.order_type || "dine_in",
            table_no:
              resolvedTableNo || currentActiveAttributes?.table_no || "",
            customer_name: currentSelectedParty?.name || currentActiveAttributes?.customer_name || "",
            customer_phone: currentSelectedParty?.phone || currentActiveAttributes?.customer_phone || "",
            customer_address: currentSelectedParty?.address || currentActiveAttributes?.customer_address || "",
          },
          items: [
            ...currentCart.map((item) => ({
              id: item.id,
              productId: item.productId,
              quantity: Number(item.quantity || 0),
              unitType: item.unitType || "primary",
              conversionRate: Number(
                item.conversionRate ||
                  getProductById(item.productId)?.conversionRate ||
                  0,
              ),
              unitPrice: Number(item.unitPrice || 0),
              taxRate: Number(item.taxRate || 0),
              lineTotal: Number(item.lineTotal || 0),
            })),
            ...deletedItemIds.map((id) => ({ id, _delete: true })),
          ],
        };

        if (currentEditingId) {
          const res = await api.updateSale(currentEditingId, payload);
          if (res?.SaleItems) {
            setCart((prevCart) =>
              prevCart.map((cartItem) => {
                const dbItem = res.SaleItems.find(
                  (db) => db.productId === cartItem.productId,
                );
                return dbItem ? { ...cartItem, id: dbItem.id } : cartItem;
              }),
            );
          }
          setDeletedItemIds([]);
        } else {
          const created = await api.createSale(payload);
          if (created?.id) {
            setEditingId(created.id);
            if (created?.SaleItems) {
              setCart((prevCart) =>
                prevCart.map((cartItem) => {
                  const dbItem = created.SaleItems.find(
                    (db) => db.productId === cartItem.productId,
                  );
                  return dbItem ? { ...cartItem, id: dbItem.id } : cartItem;
                }),
              );
            }
            setDeletedItemIds([]);
          }
        }
      } catch (err) {
        console.error("Auto-save error:", err);
      }
    }, 800);

    return () => clearTimeout(delayDebounce);
  }, [
    cart,
    activeTableId,
    editingId,
    isTablesEnabled,
    checkoutForm,
    selectedParty,
    activeAttributes,
    loading,
    deletedItemIds,
  ]);

  const addProductToCart = (product, unitType = "primary") => {
    if (!product?.id) return;

    setCart((previous) => {
      const existingIndex = previous.findIndex(
        (item) => item.productId === product.id,
      );

      if (existingIndex >= 0) {
        const currentItem = previous[existingIndex];
        const selectedUnitType = currentItem.unitType || unitType || "primary";
        const availableStock = getAvailableStockQuantity(
          product,
          selectedUnitType,
          currentItem,
        );
        const currentQty = Number(currentItem.quantity || 0);
        const newQty = currentQty + 1;

        // Check stock availability
        if (newQty > availableStock) {
          showError(
            t("sales.insufficientStock") ||
              `Insufficient stock for ${product.name}. Available: ${availableStock}`,
          );
          return previous;
        }

        return previous.map((item, index) => {
          if (index !== existingIndex) return item;
          return {
            ...item,
            quantity: newQty,
            lineTotal: Number(newQty * Number(item.unitPrice || 0)).toFixed(2),
          };
        });
      }

      // Check stock availability for new item
      const availableStock = getAvailableStockQuantity(
        product,
        unitType,
        product,
      );
      if (1 > availableStock) {
        showError(
          t("sales.insufficientStock") ||
            `Insufficient stock for ${product.name}. Available: ${availableStock}`,
        );
        return previous;
      }

      return [...previous, buildCartItem(product, unitType)];
    });
  };

  const updateCartQuantity = (productId, nextQuantity) => {
    if (!productId) return;

    const product = getProductById(productId);
    const currentItem = cart.find((item) => item.productId === productId);
    const unitType = currentItem?.unitType || "primary";
    const availableStock = getAvailableStockQuantity(
      product,
      unitType,
      currentItem,
    );
    const requestedQty = Math.max(Number(nextQuantity || 0), 0);

    // Validate stock availability
    if (requestedQty > 0 && requestedQty > availableStock) {
      showError(
        t("sales.insufficientStock") ||
          `Insufficient stock for ${product?.name}. Available: ${availableStock}`,
      );
      return;
    }

    setCart((previous) => {
      const targetItem = previous.find((item) => item.productId === productId);
      if (targetItem && requestedQty <= 0 && targetItem.id) {
        setDeletedItemIds((current) => [...current, targetItem.id]);
      }
      return previous
        .map((item) => {
          if (item.productId !== productId) return item;
          const quantity = requestedQty;
          return {
            ...item,
            quantity,
            lineTotal: (quantity * Number(item.unitPrice || 0)).toFixed(2),
          };
        })
        .filter((item) => Number(item.quantity || 0) > 0);
    });
  };

  const updateCartPrice = (productId, nextPrice) => {
    if (!productId) return;

    setCart((previous) =>
      previous.map((item) => {
        if (item.productId !== productId) return item;
        const unitPrice = Math.max(Number(nextPrice || 0), 0);
        return {
          ...item,
          unitPrice,
          lineTotal: (Number(item.quantity || 0) * unitPrice).toFixed(2),
        };
      }),
    );
  };

  const updateCartUnitType = (productId, unitType) => {
    if (!productId) return;

    setCart((previous) =>
      previous.map((item) => {
        if (item.productId !== productId) return item;
        const product = getProductById(productId) || item;
        const unitPrice = deriveUnitPrice(product, unitType);
        return {
          ...item,
          unitType,
          unitPrice,
          conversionRate: Number(
            product.conversionRate || item.conversionRate || 0,
          ),
          secondarySalePrice: Number(
            product.secondarySalePrice || item.secondarySalePrice || 0,
          ),
          salePrice: Number(
            product.salePrice || item.salePrice || item.unitPrice || 0,
          ),
          primaryUnit: product.primaryUnit || item.primaryUnit || "",
          secondaryUnit: product.secondaryUnit || item.secondaryUnit || "",
          lineTotal: (Number(item.quantity || 0) * unitPrice).toFixed(2),
        };
      }),
    );
  };

  const resetSaleFlow = () => {
    setCart([]);
    setSelectedParty(null);
    setCheckoutOpen(false);
    setCheckoutForm({
      ...emptyCheckoutForm,
      saleDate: todayISODate(),
      amountReceived: "0",
    });
    setIsPaid(true);
    setStatus({ type: "info", message: "" });
    setActiveTableId("");
    setEditingId(null);
    setActiveAttributes({});
    setDeletedItemIds([]);
    setActiveSessionOption(null);
  };

  const handleSuccessClose = () => {
    setSuccessState(null);
    if (queryRef === "orders") {
      navigate("/app/orders");
    } else if (queryRef === "billing") {
      navigate("/app/billing");
    }
  };

  const handleSubmit = async (nextAction = "save") => {
    if (submitting) return;
    if (!businessId) {
      setStatus({ type: "error", message: t("errors.businessIdRequired") });
      return;
    }
    if (!cart.length) {
      setStatus({ type: "error", message: t("sales.addFirstItem") });
      return;
    }
    if (
      cart.some(
        (item) =>
          item.unitType === "secondary" &&
          Number(item.conversionRate || 0) <= 0,
      )
    ) {
      setStatus({ type: "error", message: t("errors.conversionRequired") });
      return;
    }

    // Validate stock availability before submission
    const insufficientStockItems = cart.filter((item) => {
      const product = getProductById(item.productId);
      const stock = getAvailableStockQuantity(
        product,
        item.unitType || "primary",
        item,
      );
      return Number(item.quantity || 0) > stock;
    });

    if (insufficientStockItems.length > 0) {
      const itemNames = insufficientStockItems
        .map((item) => item.name)
        .join(", ");
      setStatus({
        type: "error",
        message:
          t("sales.insufficientStock") || `Insufficient stock: ${itemNames}`,
      });
      return;
    }

    if (requiresBankSelection(checkoutForm, receivedAmount)) {
      setStatus({ type: "error", message: bankRequiredMessage });
      return;
    }

    try {
      setSubmitting(true);
      setStatus({ type: "info", message: "" });

      const manualInvoiceNo = String(checkoutForm.invoiceNo || "").trim();
      const { paymentMethod, bankId, paymentNote, discount, ...headerFields } =
        checkoutForm;

      // Standard business (no tables): quick save = completed paid sale.
      // Cafe/restaurant (tables enabled): quick save = confirm order (due).
      // If the user explicitly entered an amount via the checkout dialog,
      // always honour that value regardless of business type.
      const isStandardQuickSave =
        !isTablesEnabled && nextAction === "save" && receivedAmount === 0;
      const resolvedReceivedAmount = isStandardQuickSave
        ? totals.grandTotal
        : receivedAmount;
      const isPaidBill = isStandardQuickSave
        ? true
        : resolvedReceivedAmount >= totals.grandTotal;

      const currentOrderType = activeSessionOption || activeAttributes?.order_type || "dine_in";
      const orderStatus = activeAttributes?.order_status || "new";
      const matchedTable = allTables.find(
        (t) => String(t.id) === String(checkoutForm.tableId),
      );
      const resolvedTableNo = matchedTable ? matchedTable.name : "";

      const payload = {
        ...headerFields,
        tableId: checkoutForm.tableId || null,
        status: isPaidBill ? "paid" : "due",
        partyId: selectedParty?.id || null,
        amountReceived: resolvedReceivedAmount,
        ...(Number(resolvedReceivedAmount || 0) > 0
          ? buildPaymentPayload({ paymentMethod, bankId, paymentNote })
          : { paymentMethod: "cash" }),
        subTotal: totals.subTotal,
        taxTotal: totals.taxTotal,
        discount: totals.discountTotal,
        discountTotal: totals.discountTotal,
        grandTotal: totals.grandTotal,
        attributes: {
          ...(activeAttributes || {}),
          order_status: orderStatus,
          order_type: activeSessionOption || activeAttributes?.order_type || "dine_in",
          table_no: resolvedTableNo || activeAttributes?.table_no || "",
          customer_name: selectedParty?.name || activeAttributes?.customer_name || "",
          customer_phone: selectedParty?.phone || activeAttributes?.customer_phone || "",
          customer_address: selectedParty?.address || activeAttributes?.customer_address || "",
        },
        items: [
          ...cart.map((item) => ({
            id: item.id,
            productId: item.productId,
            quantity: Number(item.quantity || 0),
            unitType: item.unitType || "primary",
            conversionRate: Number(
              item.conversionRate ||
                getProductById(item.productId)?.conversionRate ||
                0,
            ),
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            lineTotal: Number(item.lineTotal || 0),
          })),
          ...deletedItemIds.map((id) => ({ id, _delete: true })),
        ],
      };

      if (manualInvoiceNo) {
        payload.invoiceNo = manualInvoiceNo;
      } else {
        delete payload.invoiceNo;
      }

      const creatorValue = getCurrentCreatorValue(user);
      const salePayload = creatorValue
        ? { ...payload, createdBy: creatorValue }
        : payload;
      let created;
      if (editingId) {
        created = await api.updateSale(editingId, payload);
      } else {
        created = await api.createSale(salePayload);
      }

      // Sync table status in database
      if (payload.tableId) {
        if (payload.status === "paid") {
          await api
            .updateTable(payload.tableId, { status: "vacant" })
            .catch(() => null);
        } else {
          await api
            .updateTable(payload.tableId, { status: "occupied" })
            .catch(() => null);
        }
      }

      const nextSequences = await api.getNextSequences().catch(() => null);

      // Update local product stock levels immediately so the UI reflects
      // the correct inventory without requiring a page refresh.
      setProducts((prevProducts) =>
        prevProducts.map((product) => {
          const cartItem = cart.find((item) => item.productId === product.id);
          if (!cartItem) return product;

          const quantitySold = Number(cartItem.quantity || 0);
          const conversionRate = Number(cartItem.conversionRate || 0);
          const unitType = cartItem.unitType || "primary";

          let stockReduction = quantitySold;
          if (unitType === "secondary" && conversionRate > 0) {
            stockReduction = quantitySold / conversionRate;
          }

          return {
            ...product,
            stockOnHand: Math.max(
              0,
              Number(product.stockOnHand || 0) - stockReduction,
            ),
          };
        }),
      );

      invalidateProducts();
      setSuggestedInvoiceNo(nextSequences?.nextSaleInvoiceNo || "");
      if (isTablesEnabled && nextAction === "save") {
        setSuccessState(null);
      } else {
        setSuccessState({
          id: created?.id || "",
          invoiceNo: created?.invoiceNo || manualInvoiceNo || suggestedInvoiceNo,
          total: totals.grandTotal,
          action: nextAction,
        });
      }
      resetSaleFlow();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const renderUnitOptionButtons = ({
    selectedUnitType,
    options,
    onChange,
    stopPropagation = false,
  }) => (
    <div
      className="inline-grid w-auto grid-cols-2 gap-0.5 rounded-full border border-slate-200 bg-white px-0.5 py-0.5 text-[9px] font-semibold shadow-sm sm:flex sm:flex-wrap sm:items-center sm:gap-0.5 sm:px-0.5"
      onClick={stopPropagation ? (event) => event.stopPropagation() : undefined}
      onPointerDown={
        stopPropagation ? (event) => event.stopPropagation() : undefined
      }
      aria-label={t("products.unitType")}
    >
      {options.map((option) => {
        const isSelected = option.value === selectedUnitType;

        return (
          <button
            type="button"
            key={option.value}
            className={`min-w-0 rounded-full px-1 py-0.5 text-center text-[9px] transition sm:min-w-[3rem] ${
              isSelected
                ? "text-green-600"
                : "text-slate-500 hover:text-slate-800"
            } disabled:cursor-not-allowed disabled:text-slate-300`}
            onClick={() => onChange(option.value)}
            disabled={option.disabled}
          >
            {option.unit}
          </button>
        );
      })}
    </div>
  );

  const renderUnitSwitcher = (item) => {
    if (!item.secondaryUnit) {
      return (
        <span className="text-xs text-slate-500">
          /{" "}
          {getProductUnitLabel(item, item.unitType) || t("products.units.unit")}
        </span>
      );
    }

    const selectedUnitType = item.unitType || "primary";
    const options = [
      {
        value: "primary",
        unit: item.primaryUnit || t("products.primaryUnit"),
        disabled: false,
      },
      {
        value: "secondary",
        unit: item.secondaryUnit,
        disabled: Number(item.conversionRate || 0) <= 0,
      },
    ];

    return renderUnitOptionButtons({
      selectedUnitType,
      options,
      onChange: (nextUnitType) =>
        updateCartUnitType(item.productId, nextUnitType),
    });
  };

  const renderProductUnitSelect = (product, inCart) => {
    if (!product.secondaryUnit) return null;

    const selectedUnitType =
      inCart?.unitType || productUnitTypes[product.id] || "primary";
    const options = [
      {
        value: "primary",
        unit: product.primaryUnit || t("products.primaryUnit"),
        disabled: false,
      },
      {
        value: "secondary",
        unit: product.secondaryUnit,
        disabled: Number(product.conversionRate || 0) <= 0,
      },
    ];

    return renderUnitOptionButtons({
      selectedUnitType,
      options,
      stopPropagation: true,
      onChange: (nextUnitType) => {
        if (inCart) {
          updateCartUnitType(product.id, nextUnitType);
          return;
        }
        setProductUnitTypes((previous) => ({
          ...previous,
          [product.id]: nextUnitType,
        }));
      },
    });
  };

  const footerBar = (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-[24px] bg-slate-100 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"
              onClick={() => setPartySelectorOpen(true)}
            >
              <UserRound size={12} className="text-primary-600 shrink-0" />
              <span className="truncate">
                {selectedParty?.name || t("quickPos.walkInCustomer")}
              </span>
            </button>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {t("sales.grandTotal")}
            </p>
            <p className="text-lg font-bold text-slate-900">
              {money(totals.grandTotal)}
            </p>
          </div>
        </div>

        {isMobile && (
          <div className="flex flex-col gap-1 border-t border-slate-200/60 pt-2 text-[10px] font-medium text-slate-500">
            <div className="flex items-center justify-between">
              <span>
                {t("sales.subTotal")}: {money(totals.subTotal)}
              </span>
              {totals.taxTotal > 0 && (
                <span>
                  {t("tax")}: {money(totals.taxTotal)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/40 pt-1">
              <span>
                {t("services.amountReceived")}:{" "}
                <span className="text-slate-900 font-bold">
                  {money(receivedAmount)}
                </span>
              </span>
              <span>
                {t("services.dueAmount")}:{" "}
                <span
                  className={
                    dueAmount > 0
                      ? "text-rose-600 font-bold"
                      : "text-emerald-600 font-bold"
                  }
                >
                  {money(dueAmount)}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="btn-secondary h-11 justify-center rounded-[18px] text-sm font-bold"
          onClick={handleReviewBill}
        >
          {t("Checkout") || "Checkout"}
        </button>
        <button
          type="button"
          className="btn-primary h-11 justify-center rounded-[18px] text-sm font-bold"
          onClick={() => handleSubmit("save")}
          disabled={!cart.length || submitting}
        >
          {submitting
            ? t("common.saving")
            : isTablesEnabled
            ? (t("quickPos.confirmOrder") || "Confirm Order")
            : t("quickPos.quickSave")}
        </button>
      </div>
    </div>
  );

  if (loading && !products.length && !allTables.length) {
    return (
      <div className="min-w-0 space-y-5 pb-28 md:pb-0">
        <PageHeader title={salesTitle} subtitle={t("quickPos.subtitle")} />
        <div className="rounded-[32px] border border-dashed border-slate-200 bg-white/90 p-12 text-center text-slate-500 max-w-4xl mx-auto flex items-center justify-center h-64">
          <div className="space-y-3">
            <span className="h-6 w-6 rounded-full border-2 border-[#9b6835] border-t-transparent animate-spin inline-block" />
            <p className="text-sm font-semibold">
              {t("common.loading") || "Loading POS..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isTablesEnabled && activeSessionOption === null) {
    return (
      <div className="min-w-0 space-y-5 pb-28 md:pb-0">
        <PageHeader
          title={salesTitle}
          subtitle={t("quickPos.subtitle")}
          action={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {(queryRef === "orders" || queryRef === "billing") && (
                <button
                  type="button"
                  className="btn-ghost h-11 justify-center rounded-[18px]"
                  onClick={() =>
                    navigate(
                      queryRef === "orders" ? "/app/orders" : "/app/billing",
                    )
                  }
                >
                  ← {queryRef === "orders" ? "Seating Map" : "Billing Counter"}
                </button>
              )}
              <Link
                className="btn-ghost h-11 justify-center rounded-[18px]"
                to="/app/sales"
              >
                {t("quickPos.detailedSales")}
              </Link>
            </div>
          }
        />

        {status.message ? (
          <Notice title={status.message} tone={status.type} />
        ) : null}

        <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-sm max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-slate-800">
              Select Order Type & Seating Area
            </h2>
            <p className="text-sm text-slate-500">
              Choose one of the order options below to start adding items to order.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setActiveSessionOption("takeaway");
                setActiveTableId("");
              }}
              className="rounded-3xl border-2 border-slate-200 bg-white p-6 hover:border-[#9c5f22] hover:bg-[#9c5f22]/5 transition text-left space-y-2 flex flex-col justify-between"
            >
              <div>
                <span className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-50 text-amber-600 mb-2">
                  <ShoppingBag size={24} />
                </span>
                <h3 className="text-lg font-bold text-slate-800">
                  Takeaway / Walk-in
                </h3>
                <p className="text-xs text-slate-500">
                  Dine-out order, ready for direct billing and quick checkout.
                </p>
              </div>
              <span className="text-xs font-bold text-[#9c5f22] flex items-center gap-1 pt-2">
                Start Walk-in Order <ArrowRight size={14} />
              </span>
            </button>

            <button
              type="button"
              onClick={handleSelectDelivery}
              className="rounded-3xl border-2 border-slate-200 bg-white p-6 hover:border-[#9c5f22] hover:bg-[#9c5f22]/5 transition text-left space-y-2 flex flex-col justify-between"
            >
              <div>
                <span className="inline-flex items-center justify-center p-3 rounded-2xl bg-blue-50 text-blue-600 mb-2">
                  <Package2 size={24} />
                </span>
                <h3 className="text-lg font-bold text-slate-800">
                  Home Delivery
                </h3>
                <p className="text-xs text-slate-500">
                  Delivery order, reference party addresses and track runner details.
                </p>
              </div>
              <span className="text-xs font-bold text-[#9c5f22] flex items-center gap-1 pt-2">
                Start Delivery Order <ArrowRight size={14} />
              </span>
            </button>
          </div>

          <div className="border-t border-slate-100 pt-6 space-y-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Dine-in Floor Map
                </h3>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                {/* Floor Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none max-w-full">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 whitespace-nowrap">
                    Floor:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFloorFilter("all")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                      selectedFloorFilter === "all"
                        ? "bg-[#9c5f22] text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                    }`}
                  >
                    All Floors
                  </button>
                  {floors.map((floor) => (
                    <button
                      key={floor.id}
                      type="button"
                      onClick={() => setSelectedFloorFilter(floor.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                        selectedFloorFilter === floor.id
                          ? "bg-[#9c5f22] text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                      }`}
                    >
                      {floor.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedFloorFilter("unassigned")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                      selectedFloorFilter === "unassigned"
                        ? "bg-[#9c5f22] text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                    }`}
                  >
                    Unassigned
                  </button>
                </div>

                {/* Status Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 whitespace-nowrap">
                    Status:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter("all")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                      selectedStatusFilter === "all"
                        ? "bg-[#9c5f22] text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter("vacant")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                      selectedStatusFilter === "vacant"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                    }`}
                  >
                    Vacant
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatusFilter("occupied")}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                      selectedStatusFilter === "occupied"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                    }`}
                  >
                    Occupied
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredTablesForSelector.map((table) => {
                const isOccupied = table.status === "occupied";
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => {
                      setActiveSessionOption("dine_in");
                      handleTableChange(table.id);
                    }}
                    className={`group relative rounded-2xl border p-4 text-left transition duration-200 hover:scale-[1.02] hover:shadow-md flex flex-col justify-between h-28 ${
                      isOccupied
                        ? "border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-800"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="text-sm font-bold truncate max-w-[100px]">
                        {table.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                          isOccupied
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isOccupied ? "Occupied" : "Vacant"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 w-full pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-2">
                      <span className="text-[10px] text-slate-400">
                        {table.capacity ? `${table.capacity} seats` : "No limit"}
                      </span>
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium border border-slate-200/50 truncate max-w-[70px]">
                        {table.category?.name || "No Floor"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 pb-28 md:pb-0">
      <PageHeader
        title={salesTitle}
        subtitle={isMobile ? "" : t("quickPos.subtitle")}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isTablesEnabled && (
              <button
                type="button"
                className="btn-ghost h-11 justify-center rounded-[18px] text-slate-700 hover:text-slate-900 border border-slate-200/80 bg-white shadow-2xs font-semibold px-4"
                onClick={() => navigate(queryRef === "orders" ? "/app/orders" : "/app/billing")}
              >
                <ArrowLeft size={16} className="mr-1.5" />
                {queryRef === "orders" ? "Seating Map" : "Billing Counter"}
              </button>
            )}

            {isTablesEnabled && (
              <button
                type="button"
                onClick={() => setTableSelectorOpen(true)}
                className={`btn-secondary h-11 justify-center rounded-[18px] px-4 font-semibold transition ${
                  activeTableId
                    ? "bg-[#9c5f22]/10 text-[#9c5f22] border-[#9c5f22]/30"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                {activeTableId ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse mr-2" />
                    Table:{" "}
                    {allTables.find(
                      (t) => String(t.id) === String(activeTableId),
                    )?.name || activeTableId}{" "}
                    {editingId ? " (Editing)" : ""}
                  </>
                ) : activeSessionOption === "takeaway" ? (
                  "Walk-in / Takeaway ▾"
                ) : activeSessionOption === "delivery" ? (
                  "Delivery ▾"
                ) : (
                  "Change Seating ▾"
                )}
              </button>
            )}

            <Link
              className="btn-ghost h-11 justify-center rounded-[18px]"
              to="/app/sales"
            >
              {t("quickPos.detailedSales")}
            </Link>
          </div>
        }
      />

      <div className="md:hidden">
        <MobileFormStepper
          steps={formSteps}
          currentStep={checkoutOpen ? "details" : "items"}
          onStepChange={handleMobileStepChange}
          onNext={() => setCheckoutOpen(true)}
          onBack={handleCloseCheckout}
          canProceed={cart.length > 0}
          backLabel={t("common.back")}
          nextLabel={
            checkoutOpen
              ? t("common.continue")
              : t("quickPos.checkout")
          }
          showNavigation={false}
        />
      </div>

      {status.message ? (
        <Notice title={status.message} tone={status.type} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="rounded-[28px] border border-secondary-200/70 bg-white/90 p-3 shadow-sm sm:rounded-[32px]">
            {businessProfile?.settings?.enabledModules?.includes("tables") && (
              <div className="flex items-center justify-between bg-[#9c5f22]/5 rounded-2xl p-3 mb-3 border border-[#9c5f22]/10 md:hidden">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#9c5f22]/80">
                    Active Order Table
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    {activeTableId
                      ? `${allTables.find((t) => String(t.id) === String(activeTableId))?.name || activeTableId}${editingId ? " (Active Bill)" : ""}`
                      : "No Table / Takeaway"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => navigate(queryRef === "orders" ? "/app/orders" : "/app/billing")}
                    className="px-2.5 py-1.5 bg-white text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-2xs flex items-center"
                  >
                    <ArrowLeft size={14} className="mr-1" />
                    Billing
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableSelectorOpen(true)}
                    className="px-3 py-1.5 bg-[#9c5f22] text-white text-xs font-bold rounded-xl shadow"
                  >
                    Change Table
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  {!search && (
                    <Search
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      size={20}
                    />
                  )}
                  <input
                    className={`h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 text-base font-medium text-slate-900 focus:bg-white focus:border-[#9c5f22] focus:ring-2 focus:ring-[#9c5f22]/10 transition shadow-2xs ${
                      search ? "px-4 pr-10" : "pl-11 pr-4"
                    }`}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("quickPos.searchPlaceholder") || "Search menu items, code, or category..."}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100 transition"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {categoryOptions.length > 7 && (
                    <select
                      id="quick-pos-category"
                      className="input h-12 rounded-2xl bg-slate-50 px-3 text-xs font-bold text-slate-700 focus:bg-white border-slate-200 max-w-[150px] truncate"
                      value={selectedCategory}
                      onChange={(event) => setSelectedCategory(event.target.value)}
                    >
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category === "all"
                            ? t("quickPos.allCategories")
                            : category}
                        </option>
                      ))}
                    </select>
                  )}
                  <Link
                    className="btn-secondary h-12 justify-center rounded-2xl text-xs font-bold px-4 shrink-0"
                    to="/app/inventory"
                  >
                    + {t("quickPos.addNewItem")}
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {quickCategoryOptions.map((category) => {
                  const isActive = category === selectedCategory;
                  const label =
                    category === "all" ? t("quickPos.allCategories") : category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSelectedCategory(category)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                        isActive
                          ? "bg-[#9c5f22] text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[32px] border border-dashed border-slate-200 bg-white/70 px-5 py-12 text-center text-slate-500">
              {t("common.loading")}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-[32px] border border-dashed border-slate-200 bg-white/70 px-5 py-12 text-center">
              <Package2 className="mx-auto text-slate-300" size={34} />
              <p className="mt-4 text-lg font-semibold text-slate-700">
                {t("quickPos.noProducts")}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {t("quickPos.noProductsHint")}
              </p>
            </div>
          ) : (
            <div
              ref={mobileProductScrollRef}
              className={
                isMobile
                  ? "max-h-[410px] overflow-y-auto pr-1 overscroll-contain"
                  : ""
              }
              onScroll={isMobile ? handleMobileProductScroll : undefined}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleProducts.map((product) => {
                  const inCart = cart.find(
                    (item) => item.productId === product.id,
                  );
                  const inCartQty = inCart
                    ? Number(inCart.quantity).toFixed(0)
                    : "0";
                  const selectedUnitType =
                    inCart?.unitType ||
                    productUnitTypes[product.id] ||
                    "primary";
                  const selectedUnitPrice = deriveUnitPrice(
                    product,
                    selectedUnitType,
                  );
                  const isOutOfStock = Number(product.stockOnHand || 0) <= 0;

                  return (
                    <article
                      key={product.id}
                      className={`flex flex-col overflow-hidden rounded-[24px] border bg-white shadow-sm transition-all hover:shadow-md ${
                        isOutOfStock
                          ? "opacity-75 bg-red-50 border-red-200"
                          : inCart
                            ? "border-primary ring-1 ring-primary-500 shadow-sm"
                            : "border-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex flex-1 flex-col p-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-xs font-bold text-slate-900 ${isOutOfStock ? "text-red-900" : ""}`}
                            >
                              {product.name}
                            </p>
                            <p
                              className={`mt-0.5 truncate text-[12px] text-slate-500 ${isOutOfStock ? "text-red-600" : ""}`}
                            >
                              {product.categoryName ||
                                product.companyName ||
                                t("general")}
                            </p>
                          </div>
                          <div className="shrink-0 w-full max-w-full sm:w-auto">
                            {renderProductUnitSelect(product, inCart)}
                          </div>
                        </div>

                        <div className="mt-auto pt-2">
                          <div className="flex items-end justify-between gap-1">
                            <p
                              className={`text-xs font-bold ${isOutOfStock ? "text-red-700" : "text-primary-700"}`}
                            >
                              {money(
                                inCart?.unitPrice ||
                                  selectedUnitPrice ||
                                  product.sellingPrice ||
                                  product.salePrice ||
                                  0,
                              )}
                            </p>
                            <p
                              className={`text-[11px] font-medium ${isOutOfStock ? "text-red-400" : "text-slate-400"}`}
                            >
                              {formatStockLabel(product, selectedUnitType)}
                            </p>
                          </div>

                          <div className="mt-2 flex">
                            {isOutOfStock ? (
                              <div className="w-full text-center py-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wider">
                                {t("products.outOfStock") || "Out of Stock"}
                              </div>
                            ) : Number(inCartQty) > 0 ? (
                              <div className="flex w-full items-center justify-between rounded-full bg-primary-50 px-1 py-1">
                                <button
                                  type="button"
                                  className="rounded-full bg-white p-1 text-primary shadow-sm"
                                  onClick={() =>
                                    updateCartQuantity(
                                      product.id,
                                      Number(inCartQty) - 1,
                                    )
                                  }
                                >
                                  <Minus size={12} />
                                </button>
                                <div className="flex items-center gap-0.5 min-w-0 flex-1 px-1">
                                  <input
                                    className="w-full border-0 bg-transparent p-0 text-center text-xs font-bold text-primary-900 focus:outline-none focus:ring-0"
                                    type="number"
                                    inputMode="decimal"
                                    value={inCartQty}
                                    onChange={(e) =>
                                      updateCartQuantity(
                                        product.id,
                                        e.target.value,
                                      )
                                    }
                                  />
                                </div>
                                <button
                                  type="button"
                                  className="rounded-full bg-primary p-1 text-white shadow-sm"
                                  onClick={() =>
                                    updateCartQuantity(
                                      product.id,
                                      Number(inCartQty) + 1,
                                    )
                                  }
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn-ghost w-full justify-center rounded-full py-1.5 text-xs"
                                onClick={() =>
                                  addProductToCart(product, selectedUnitType)
                                }
                              >
                                {t("common.add")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
              {hasMoreMobileProducts ? (
                <div
                  ref={mobileProductLoadMoreRef}
                  className="h-8"
                  aria-hidden="true"
                />
              ) : null}
            </div>
          )}
        </div>



        <aside className="hidden xl:block">
          <div className="sticky top-6 rounded-[32px] border border-secondary-200/70 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t("quickPos.currentBill")}
                </p>
                <h3 className="mt-2 font-serif text-2xl text-slate-900">
                  {suggestedInvoiceNo || t("quickPos.draftBill")}
                </h3>
              </div>
              <button
                type="button"
                className="btn-ghost rounded-full px-3"
                onClick={() => setPartySelectorOpen(true)}
              >
                {selectedParty ? t("common.change") : t("quickPos.selectParty")}
              </button>
            </div>

            {/* <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-700">
                  <UserRound size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{selectedParty?.name || t('quickPos.walkInCustomer')}</p>
                  <p className="mt-1 text-sm text-slate-500">{selectedParty?.phone || t('quickPos.walkInHint')}</p>
                </div>
              </div>
            </div> */}

            {activeSessionOption === "delivery" && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                    <Truck size={14} className="text-[#9c5f22]" /> Delivery Details
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryFormState({
                        customerName: activeAttributes?.customer_name || selectedParty?.name || "",
                        customerPhone: activeAttributes?.customer_phone || selectedParty?.phone || "",
                        location: activeAttributes?.customer_address || selectedParty?.address || "",
                        notes: checkoutForm?.notes || ""
                      });
                      setDeliveryFormOpen(true);
                    }}
                    className="text-xs font-semibold text-[#9c5f22] hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <div className="text-xs space-y-1 text-slate-700">
                  <p><span className="font-semibold text-slate-900">Name:</span> {activeAttributes?.customer_name || "-"}</p>
                  <p><span className="font-semibold text-slate-900">Phone:</span> {activeAttributes?.customer_phone || "-"}</p>
                  <p><span className="font-semibold text-slate-900">Location:</span> {activeAttributes?.customer_address || "-"}</p>
                  {checkoutForm?.notes && <p><span className="font-semibold text-slate-900">Notes:</span> {checkoutForm.notes}</p>}
                </div>
              </div>
            )}

            <div className="mt-5 max-h-[340px] space-y-3 overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <ShoppingBag className="mx-auto text-slate-300" size={28} />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {t("quickPos.emptyCart")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("quickPos.emptyCartHint")}
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.productId}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-xs text-slate-500">
                            {t("currency.symbol")}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            className="w-20 border-0 bg-transparent p-0 text-xs font-medium text-slate-600 focus:outline-none focus:ring-0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateCartPrice(item.productId, e.target.value)
                            }
                          />
                          {renderUnitSwitcher(item)}
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-primary-700">
                        {money(item.lineTotal)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[18px] bg-white px-3 py-1">
                      <div className="flex items-center gap-2 rounded-full border border-primary-100 bg-white px-1">
                        <button
                          type="button"
                          className="rounded-full bg-slate-100 p-2 text-slate-600"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              Number(item.quantity) - 1,
                            )
                          }
                        >
                          <Minus size={14} />
                        </button>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            className="w-12 border-0 bg-transparent p-0 text-center text-sm font-semibold text-slate-900 focus:outline-none focus:ring-0"
                            value={item.quantity}
                            onChange={(e) =>
                              updateCartQuantity(item.productId, e.target.value)
                            }
                          />
                          <span className="text-xs text-slate-500">
                            {getProductUnitLabel(item, item.unitType)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="rounded-full bg-primary p-2 text-white"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              Number(item.quantity) + 1,
                            )
                          }
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-rose-100 bg-white p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => updateCartQuantity(item.productId, 0)}
                        aria-label={t("common.delete")}
                        title={t("common.delete")}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{t("sales.subTotal")}</span>
                <span>{money(totals.subTotal)}</span>
              </div>

              <label className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span className="min-w-0 max-w-full">
                  <span className="block">{t("Tax") || "VAT"}</span>
                  <span className="block text-[11px] font-semibold text-primary-700">
                    {Number(checkoutForm.taxRate || 0) > 0
                      ? money(totals.taxTotal)
                      : `+ ${t("sales.addTax")}`}
                  </span>
                </span>
                <div className="min-w-[7rem] w-full max-w-[8rem] shrink-0 sm:w-auto">
                  <div className="relative">
                    <input
                      className="input h-8 w-full rounded-lg border-primary/20 pr-9 text-right text-xs font-bold focus:border-primary focus:ring-primary/10"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={checkoutForm.taxRate || ""}
                      onChange={(event) =>
                        setCheckoutForm((previous) => ({
                          ...previous,
                          taxRate: event.target.value,
                        }))
                      }
                      placeholder="0"
                    />
                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                      %
                    </div>
                  </div>
                </div>
              </label>

              <label className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                <span className="min-w-0 max-w-full">
                  <span className="block">{t("quickPos.discount")}</span>
                  <span className="block text-[11px] font-semibold text-primary-700">
                    {Number(checkoutForm.discount || 0) > 0
                      ? `- ${money(totals.discountTotal)}`
                      : `+ ${t("sales.addDiscount")}`}
                  </span>
                </span>
                <div className="min-w-[7rem] w-full max-w-[8rem] shrink-0 sm:w-auto">
                  <div className="relative">
                    <input
                      className="input h-8 w-full rounded-lg border-primary/20 pr-10 text-right text-xs font-bold focus:border-primary focus:ring-primary/10"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={checkoutForm.discount}
                      onChange={(event) =>
                        setCheckoutForm((previous) => ({
                          ...previous,
                          discount: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                    />
                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                      {t("currency.symbol")}
                    </div>
                  </div>
                </div>
              </label>

              {selectedParty && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
                  <span>{t("services.amountReceived")}</span>
                  {showAmountReceivedInput && !isPaid ? (
                    <div className="min-w-[7rem] w-full max-w-[8rem] shrink-0 sm:w-auto">
                      <div className="relative">
                        <input
                          autoFocus
                          className="input h-8 rounded-lg pr-10 text-right font-bold w-full border-primary/20 focus:border-primary focus:ring-primary/10 text-xs"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={checkoutForm.amountReceived}
                          onChange={(event) =>
                            setCheckoutForm((previous) => ({
                              ...previous,
                              amountReceived: event.target.value,
                            }))
                          }
                          onBlur={() => setShowAmountReceivedInput(false)}
                        />
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          {t("currency.symbol")}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isPaid) setIsPaid(false);
                          setShowAmountReceivedInput(true);
                        }}
                        className="hover:text-primary-600 transition-colors font-medium"
                      >
                        {isPaid
                          ? money(totals.grandTotal)
                          : Number(checkoutForm.amountReceived || 0) > 0
                            ? money(checkoutForm.amountReceived)
                            : `+ ${t("sales.addReceived")}`}
                      </button>
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded accent-primary-600 cursor-pointer"
                        checked={isPaid}
                        onChange={(e) => setIsPaid(e.target.checked)}
                        title={t("quickPos.fullyPaid")}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedParty && dueAmount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-amber-600">
                  <span>{t("sales.dueAmount")}</span>
                  <span>{money(dueAmount)}</span>
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-lg font-bold text-slate-900">
                <span>{t("sales.grandTotal")}</span>
                <span>{money(totals.grandTotal)}</span>
              </div>
            </div>

            <div className="mt-5">{footerBar}</div>
          </div>
        </aside>
      </div>

      {isMobile ? (
        <div className="mobile-sticky-actions xl:hidden">{footerBar}</div>
      ) : null}

      <Dialog
        isOpen={checkoutOpen}
        onClose={handleCloseCheckout}
        title={t("quickPos.confirmSale")}
        size="full"
        footer={
          <div className="flex w-full flex-col gap-3 md:flex-row">
            <button
              type="button"
              className="btn-secondary w-full justify-center rounded-[22px] md:w-auto md:flex-1"
              onClick={() => handleSubmit("print")}
              disabled={!cart.length || submitting}
            >
              {t("quickPos.saveAndPrint")}
            </button>
            <button
              type="button"
              className="btn-primary w-full justify-center rounded-[22px] md:w-auto md:flex-1"
              onClick={() => handleSubmit("save")}
              disabled={!cart.length || submitting}
            >
              {submitting
                ? t("common.saving")
                : isTablesEnabled
                ? (t("quickPos.confirmOrder") || "Confirm Order")
                : t("quickPos.saveOnly")}
            </button>
          </div>
        }
      >
        <div className="space-y-3 overflow-x-hidden">
          {status.message ? (
            <Notice title={status.message} tone={status.type} />
          ) : null}
          <div
            className={`grid gap-2 sm:grid-cols-2 ${businessProfile?.settings?.enabledModules?.includes("tables") ? "lg:grid-cols-3" : ""}`}
          >
            <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 transition focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-200">
              <span className="text-xs font-medium uppercase text-slate-500">
                {t("quickPos.invoiceNumber")}
              </span>
              <input
                className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                value={checkoutForm.invoiceNo}
                onChange={(event) =>
                  setCheckoutForm((previous) => ({
                    ...previous,
                    invoiceNo: event.target.value,
                  }))
                }
                placeholder={suggestedInvoiceNo || t("quickPos.autoInvoice")}
              />
            </label>

            <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 transition focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-200">
              <span className="text-xs font-medium uppercase text-slate-500">
                {t("common.date")}
              </span>
              <input
                className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-0"
                type="date"
                value={checkoutForm.saleDate}
                onChange={(event) =>
                  setCheckoutForm((previous) => ({
                    ...previous,
                    saleDate: event.target.value,
                  }))
                }
              />
            </label>

            {businessProfile?.settings?.enabledModules?.includes("tables") && (
              <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 transition focus-within:border-[#9c5f22] focus-within:ring-1 focus-within:ring-[#9c5f22]/20">
                <span className="text-xs font-medium uppercase text-slate-500">
                  {t("tables.tableName") || "Table"}
                </span>
                <select
                  className="mt-1 w-full border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-0"
                  value={checkoutForm.tableId || ""}
                  onChange={(event) =>
                    setCheckoutForm((previous) => ({
                      ...previous,
                      tableId: event.target.value,
                    }))
                  }
                >
                  <option value="">No Table / Takeaway</option>
                  {vacantTables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.name}{" "}
                      {table.capacity ? `(Cap: ${table.capacity})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                  <UserRound size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {selectedParty?.name || t("quickPos.walkInCustomer")}
                  </p>
                  {selectedParty?.phone && (
                    <p className="truncate text-xs text-slate-500">
                      {selectedParty.phone}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost rounded-md px-2 text-xs font-semibold"
                onClick={() => setPartySelectorOpen(true)}
              >
                {selectedParty ? t("common.change") : t("quickPos.selectParty")}
              </button>
            </div>
          </div>

          {activeSessionOption === "delivery" && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Truck size={12} className="text-[#9c5f22]" /> Delivery Details
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryFormState({
                      customerName: activeAttributes?.customer_name || selectedParty?.name || "",
                      customerPhone: activeAttributes?.customer_phone || selectedParty?.phone || "",
                      location: activeAttributes?.customer_address || selectedParty?.address || "",
                      notes: checkoutForm?.notes || ""
                    });
                    setDeliveryFormOpen(true);
                  }}
                  className="text-[10px] font-bold text-[#9c5f22] hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="text-xs space-y-0.5 text-slate-700">
                <p><span className="font-semibold text-slate-900">Name:</span> {activeAttributes?.customer_name || "-"}</p>
                <p><span className="font-semibold text-slate-900">Phone:</span> {activeAttributes?.customer_phone || "-"}</p>
                <p><span className="font-semibold text-slate-900">Location:</span> {activeAttributes?.customer_address || "-"}</p>
                {checkoutForm?.notes && <p><span className="font-semibold text-slate-900">Notes:</span> {checkoutForm.notes}</p>}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-slate-600">
                {t("quickPos.billingItems", { count: cart.length })}
              </p>
              <button
                type="button"
                className="btn-ghost rounded-md px-2 text-xs"
                onClick={() => setCheckoutOpen(false)}
              >
                {t("quickPos.addItems")}
              </button>
            </div>

            <div className="mt-2 space-y-1.5 max-h-[180px] overflow-y-auto overflow-x-hidden">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {item.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-slate-600">
                        <span>{t("currency.symbol")}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-16 border-0 bg-transparent p-0 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateCartPrice(item.productId, e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1">
                        <button
                          type="button"
                          className="p-0.5 text-slate-600 hover:text-slate-900"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              Number(item.quantity) - 1,
                            )
                          }
                        >
                          <Minus size={10} />
                        </button>
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-8 border-0 bg-transparent p-0 text-center text-xs font-semibold text-slate-900 focus:outline-none focus:ring-0"
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartQuantity(item.productId, e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="p-0.5 text-primary hover:text-primary-700"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              Number(item.quantity) + 1,
                            )
                          }
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <button
                        type="button"
                        className="p-0.5 text-rose-500 hover:text-rose-600"
                        onClick={() => updateCartQuantity(item.productId, 0)}
                        title={t("common.delete")}
                      >
                        <X size={10} />
                      </button>
                      <span className="font-bold text-primary-700">
                        {money(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-200/40 bg-gradient-to-br from-amber-50/60 to-yellow-50/40 px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                      {t("quickPos.discount")}
                    </p>
                    <p className="text-lg font-bold text-amber-700">
                      {Number(checkoutForm.discount || 0) > 0
                        ? `- ${money(totals.discountTotal)}`
                        : t("sales.addDiscount")}
                    </p>
                  </div>
                  <div className="relative flex-1 max-w-[130px] flex justify-end">
                    <div className="relative w-full">
                      <input
                        className="input h-10 w-full rounded-xl border-amber-300/30 bg-white/80 pr-8 text-right font-semibold text-sm focus:border-amber-400 focus:ring-amber-100/50"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={checkoutForm.discount}
                        onChange={(event) =>
                          setCheckoutForm((previous) => ({
                            ...previous,
                            discount: event.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">
                        {t("currency.symbol")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200/40 bg-gradient-to-br from-blue-50/60 to-cyan-50/40 px-4 py-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                      {t("tax") || "VAT"}
                    </p>
                    <p className="text-lg font-bold text-blue-700">
                      {Number(checkoutForm.taxRate || 0) > 0
                        ? money(totals.taxTotal)
                        : t("sales.addTax")}
                    </p>
                  </div>
                  <div className="relative flex-1 max-w-[130px] flex justify-end">
                    <div className="relative w-full">
                      <input
                        className="input h-10 w-full rounded-xl border-blue-300/30 bg-white/80 pr-8 text-right font-semibold text-sm focus:border-blue-400 focus:ring-blue-100/50"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={checkoutForm.taxRate || ""}
                        onChange={(event) =>
                          setCheckoutForm((previous) => ({
                            ...previous,
                            taxRate: event.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500">
                        %
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {t("common.notes")}
                </p>
                <NoteTextarea
                  className="input mt-2.5 min-h-[80px] resize-none rounded-xl text-sm border-slate-200 focus:border-primary focus:ring-primary/10"
                  value={checkoutForm.notes}
                  onChange={(event) =>
                    setCheckoutForm((previous) => ({
                      ...previous,
                      notes: event.target.value,
                    }))
                  }
                  placeholder={t("quickPos.notesPlaceholder")}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{t("sales.subTotal")}</span>
                    <span className="font-semibold text-slate-900">
                      {money(totals.subTotal)}
                    </span>
                  </div>
                  {totals.taxTotal > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{t("sales.taxTotal")}</span>
                      <span className="font-semibold text-slate-900">
                        {money(totals.taxTotal)}
                      </span>
                    </div>
                  )}
                  {totals.discountTotal > 0 && (
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{t("quickPos.discount")}</span>
                      <span className="font-semibold text-slate-900">
                        - {money(totals.discountTotal)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                    <span>{t("sales.grandTotal")}</span>
                    <span>{money(totals.grandTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {t("services.amountReceived") || "Amount Received"}
                  </span>
                  <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 transition shrink-0">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded accent-primary-600 cursor-pointer"
                      checked={dueAmount === 0}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setIsPaid(checked);
                        if (checked) {
                          setCheckoutForm((prev) => ({
                            ...prev,
                            amountReceived: totals.grandTotal.toFixed(2),
                          }));
                        } else {
                          setCheckoutForm((prev) => ({
                            ...prev,
                            amountReceived: "0",
                          }));
                        }
                      }}
                    />
                    {t("quickPos.fullyPaid") || "Fully Paid"}
                  </label>
                </div>

                <div className="flex w-full items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition">
                  <span className="flex h-10 items-center bg-slate-100 px-3 text-xs font-bold text-slate-500 border-r border-slate-200 shrink-0">
                    {t("currency.symbol") || "Rs"}
                  </span>
                  <input
                    className="h-10 w-full bg-transparent px-3 text-sm font-bold text-slate-900 focus:outline-none"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={checkoutForm.amountReceived}
                    onChange={(event) => {
                      const val = event.target.value;
                      setCheckoutForm((previous) => ({
                        ...previous,
                        amountReceived: val,
                      }));
                    }}
                    placeholder="0.00"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {quickAmountOptions.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCheckoutForm((prev) => ({
                          ...prev,
                          amountReceived: String(opt.value.toFixed(2)),
                        }));
                      }}
                      className="px-2.5 py-1 rounded-xl border border-slate-200 hover:border-primary text-xs font-bold text-slate-700 bg-slate-50 hover:bg-primary/5 transition shadow-2xs"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {changeAmount > 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 flex justify-between items-center shadow-2xs">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-emerald-600" />
                      {t("sales.changeToReturn") || "Change to Return"}
                    </span>
                    <span className="text-sm font-black text-emerald-700">{money(changeAmount)}</span>
                  </div>
                ) : dueAmount > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-800 flex justify-between items-center shadow-2xs">
                    <span>{t("sales.dueAmount") || "Due Amount"}</span>
                    <span className="text-sm font-black text-amber-700">{money(dueAmount)}</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-4 min-w-0">
                <PaymentMethodFields
                  value={checkoutForm}
                  onChange={handleCheckoutPaymentChange}
                  bankAccountError={bankAccountError}
                />
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      <QuickPartySelector
        isOpen={partySelectorOpen}
        onClose={() => setPartySelectorOpen(false)}
        onSelect={setSelectedParty}
        selectedParty={selectedParty}
        type="customer"
        includeWalkIn
        walkInLabel={t("quickPos.walkInCustomer")}
        walkInDescription={t("quickPos.walkInHint")}
        title={t("quickPos.selectPartyTitle")}
      />

      <QuickActionSuccessDialog
        isOpen={Boolean(successState)}
        onClose={handleSuccessClose}
        closeLabel={t("common.close")}
        title={t("quickPos.saleRecorded")}
        description={
          successState
            ? t("quickPos.saleRecordedDescription", {
                invoice: successState.invoiceNo || t("quickPos.draftBill"),
                amount: money(successState.total),
              })
            : ""
        }
        primaryAction={
          successState?.id ? (
            <button
              type="button"
              className="btn-primary h-14 w-full justify-center rounded-[22px] text-base"
              onClick={() => {
                const target =
                  successState.action === "print"
                    ? `/app/invoice/sales/${successState.id}?print=1`
                    : `/app/invoice/sales/${successState.id}`;
                setSuccessState(null);
                navigate(target);
              }}
            >
              {successState?.action === "print"
                ? t("quickPos.openPrintPreview")
                : t("quickPos.viewInvoice")}
            </button>
          ) : null
        }
        secondaryAction={
          successState?.id ? (
            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                className="btn-secondary h-14 w-full justify-center rounded-[22px] text-base bg-secondary-100 text-secondary-900 hover:bg-secondary-200"
                onClick={() => {
                  setSuccessState(null);
                  navigate(`/app/invoice/sales/${successState.id}?thermal=1`);
                }}
              >
                Print Thermal Receipt
              </button>
              <button
                type="button"
                className="btn-ghost h-14 w-full justify-center rounded-[22px] text-base"
                onClick={handleSuccessClose}
              >
                {t("quickPos.newSale")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-ghost h-14 w-full justify-center rounded-[22px] text-base"
              onClick={handleSuccessClose}
            >
              {t("quickPos.newSale")}
            </button>
          )
        }
      />

      {/* Table Selector Modal */}
      <Dialog
        isOpen={tableSelectorOpen}
        onClose={() => setTableSelectorOpen(false)}
        title="Select Table Plan"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Choose Table or Seating Area
            </p>
            <button
              type="button"
              onClick={() => {
                setTableSelectorOpen(false);
                navigate("/app/billing");
              }}
              className="text-xs font-bold text-[#9c5f22] hover:underline flex items-center gap-1"
            >
              Billing Counter Grid →
            </button>
          </div>

          <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            {/* Floor Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 whitespace-nowrap shrink-0">Floor:</span>
              <button
                type="button"
                onClick={() => setSelectedFloorFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedFloorFilter === 'all'
                    ? 'bg-[#9c5f22] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                All Floors
              </button>
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => setSelectedFloorFilter(floor.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                    selectedFloorFilter === floor.id
                      ? 'bg-[#9c5f22] text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {floor.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedFloorFilter('unassigned')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedFloorFilter === 'unassigned'
                    ? 'bg-[#9c5f22] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                Unassigned
              </button>
            </div>

            {/* Status Filters */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100/60 pt-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 whitespace-nowrap shrink-0">Status:</span>
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedStatusFilter === 'all'
                    ? 'bg-[#9c5f22] text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('vacant')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedStatusFilter === 'vacant'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                Vacant
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatusFilter('occupied')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                  selectedStatusFilter === 'occupied'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                Occupied
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setActiveSessionOption("takeaway");
                handleTableChange("");
                setTableSelectorOpen(false);
              }}
              className={`rounded-2xl border p-4 text-center transition flex flex-col justify-center items-center h-28 ${
                activeSessionOption === "takeaway" && !activeTableId
                  ? "border-[#9c5f22] bg-[#9c5f22]/5 font-bold text-[#9c5f22]"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              }`}
            >
              <span className="text-sm font-semibold">Walk-in / Takeaway</span>
              <span className="text-[10px] text-slate-400 mt-1">
                No table reference
              </span>
            </button>

            <button
              type="button"
              onClick={handleSelectDelivery}
              className={`rounded-2xl border p-4 text-center transition flex flex-col justify-center items-center h-28 ${
                activeSessionOption === "delivery" && !activeTableId
                  ? "border-[#9c5f22] bg-[#9c5f22]/5 font-bold text-[#9c5f22]"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              }`}
            >
              <span className="text-sm font-semibold">Home Delivery</span>
              <span className="text-[10px] text-slate-400 mt-1">
                No table reference
              </span>
            </button>

            {filteredTablesForSelector.map((table) => {
              const isSelected = String(table.id) === String(activeTableId);
              const isOccupied = table.status === "occupied";

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => {
                    setActiveSessionOption("dine_in");
                    handleTableChange(table.id);
                    setTableSelectorOpen(false);
                  }}
                  className={`group relative rounded-2xl border p-4 text-left transition duration-200 hover:scale-[1.02] hover:shadow-md flex flex-col justify-between h-28 ${
                    isSelected
                      ? "border-[#9c5f22] bg-[#9c5f22]/10 font-bold text-[#9c5f22] shadow-sm"
                      : isOccupied
                        ? "border-amber-200 bg-amber-50/50 hover:bg-amber-100 text-amber-800"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="text-sm font-bold truncate max-w-[90px]">{table.name}</span>
                    <span className={`px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${isOccupied ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                      {isOccupied ? "Occupied" : "Vacant"}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-1 w-full pt-1.5 border-t border-slate-100 dark:border-slate-800 mt-2">
                    <span className="text-[10px] text-slate-400">{table.capacity ? `${table.capacity} seats` : "No limit"}</span>
                    <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium border border-slate-200/50 truncate max-w-[70px]">
                      {table.category?.name || "No Floor"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setTableSelectorOpen(false)}
              className="btn-secondary rounded-xl py-2 px-4 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delivery Information Dialog */}
      <Dialog
        isOpen={deliveryFormOpen}
        onClose={() => setDeliveryFormOpen(false)}
        title="Delivery Information"
        size="md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCheckoutForm((prev) => ({ ...prev, notes: deliveryFormState.notes }));
            setActiveAttributes((prev) => ({
              ...prev,
              customer_name: deliveryFormState.customerName,
              customer_phone: deliveryFormState.customerPhone,
              customer_address: deliveryFormState.location,
            }));
            setDeliveryFormOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="label text-slate-700 font-semibold text-xs">Customer Name</label>
            <input
              type="text"
              required
              className="input mt-1.5 w-full rounded-xl border border-slate-200 text-sm focus:border-primary"
              placeholder="Enter customer name"
              value={deliveryFormState.customerName}
              onChange={(e) => setDeliveryFormState(prev => ({ ...prev, customerName: e.target.value }))}
            />
          </div>
          <div>
            <label className="label text-slate-700 font-semibold text-xs">Phone Number (Optional)</label>
            <input
              type="tel"
              className="input mt-1.5 w-full rounded-xl border border-slate-200 text-sm focus:border-primary"
              placeholder="Enter phone number"
              value={deliveryFormState.customerPhone}
              onChange={(e) => setDeliveryFormState(prev => ({ ...prev, customerPhone: e.target.value }))}
            />
          </div>
          <div>
            <label className="label text-slate-700 font-semibold text-xs">Location / Address</label>
            <textarea
              required
              className="input mt-1.5 w-full rounded-xl border border-slate-200 text-sm min-h-[70px] resize-none focus:border-primary"
              placeholder="Enter delivery address"
              value={deliveryFormState.location}
              onChange={(e) => setDeliveryFormState(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>
          <div>
            <label className="label text-slate-700 font-semibold text-xs">Notes / Special Instructions</label>
            <textarea
              className="input mt-1.5 w-full rounded-xl border border-slate-200 text-sm min-h-[70px] resize-none focus:border-primary"
              placeholder="Special instructions for delivery"
              value={deliveryFormState.notes}
              onChange={(e) => setDeliveryFormState(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setDeliveryFormOpen(false)}
              className="btn-secondary rounded-xl py-2 px-4 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary rounded-xl py-2 px-4 text-xs font-semibold"
            >
              Save Delivery Info
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
