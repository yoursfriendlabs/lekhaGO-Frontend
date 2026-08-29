import Notice from "@/components/ui/Notice";
import Pagination from "@/components/ui/Pagination";
import RefreshButton from "@/components/ui/RefreshButton.jsx";
import PaymentTypeSummary from "@/components/form/PaymentTypeSummary.jsx";
import PageHeader from "@/components/layout/PageHeader";
import PartyFilterSelect from "@/components/parties/PartyFilterSelect.jsx";
import CreatorFilterSelect from "@/components/form/CreatorFilterSelect.jsx";
import ActionMenu from "@/components/ui/ActionMenu.jsx";
import StatsCard, { STATS_GRID_CLASS } from "@/components/ui/StatsCard.jsx";
import {
  Plus,
  Check,
  CalendarDays,
  LayoutList,
  UserRound,
  Wallet,
  Globe,
  Building2,
} from "lucide-react";
import { getCreatorDisplayName } from "@/lib/records";
import { isIrdCancelled, isIrdLocked } from "@/lib/compliance/ird";
import { AttachmentStrip } from "./ServiceOrderAttachments.jsx";
import { DeliveryBadge, FilterChip, StatusBadge } from "./ServiceOrderBadges.jsx";
import {
  getDeliveryDaysLeft,
  getServiceAttachmentUrls,
  TABLE_ROW_OPTIONS,
} from "./serviceOrderUtils.js";

export default function ServiceOrderList({
  t,
  money,
  servicesTitle,
  servicesSubtitle,
  canManageServices,
  openDialog,
  newOrderLabel,
  stats,
  statsLoading,
  listNotice,
  listError,
  partyFilterId,
  selectedPartyFilterOption,
  handlePartyFilterChange,
  createdByFilterId,
  setCreatedByFilterId,
  storeTypeFilter,
  setStoreTypeFilter,
  refreshingServices,
  refreshServices,
  statusFilterOptions,
  statusFilter,
  setStatusFilter,
  listLoading,
  safeServiceList,
  pagedServices,
  isGym,
  openStatusDialog,
  openPayDialog,
  openLightbox,
  buildServiceActions,
  page,
  pageSize,
  serviceTotal,
  serviceTotalKnown,
  setPage,
  setPageSize,
}) {
  return (
    <>
      <PageHeader
        title={servicesTitle}
        subtitle={servicesSubtitle}
        action={
          canManageServices ? (
            <button
              className="btn-primary w-full sm:w-auto"
              type="button"
              onClick={openDialog}
            >
              <Plus size={16} className="mr-1.5 inline" />
              {newOrderLabel}
            </button>
          ) : null
        }
      />

      <div className={STATS_GRID_CLASS}>
        <StatsCard
          title={t("services.totalOrders")}
          value={stats?.totalOrders ?? 0}
          icon={LayoutList}
          tone="default"
          loading={statsLoading}
        />
        <StatsCard
          title={t("services.closed")}
          value={stats?.closedCount ?? 0}
          icon={Check}
          tone="success"
          loading={statsLoading}
        />
        <StatsCard
          title={t("services.activeJobs")}
          value={stats?.inProgressCount ?? 0}
          icon={CalendarDays}
          tone="warning"
          loading={statsLoading}
        />
        <StatsCard
          title={t("services.pendingCollection")}
          value={money(stats?.pendingCollection ?? 0)}
          icon={Wallet}
          tone="danger"
          loading={statsLoading}
        />
      </div>

      {listNotice.message ? (
        <Notice title={listNotice.message} tone={listNotice.type} />
      ) : null}
      {listError ? <Notice title={listError} tone="error" /> : null}

      <div className="card !p-0 overflow-hidden">
        <div className="border-b border-secondary-200/70 px-4 py-4 dark:border-slate-800/70 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <h3 className="font-serif text-2xl text-ink">
                {t("services.recentOrders")}
              </h3>
              <p className="mt-1 text-sm text-secondary-500">
                {t("services.browseOrdersHint")}
              </p>
            </div>

            <div className="grid w-full gap-3 xl:max-w-4xl xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-end">
              <div>
                <label className="label">{t("services.filterByParty")}</label>
                <PartyFilterSelect
                  className="mt-1"
                  type="customer"
                  value={partyFilterId}
                  selectedOption={selectedPartyFilterOption}
                  onChange={handlePartyFilterChange}
                  placeholder={t("services.allParties")}
                  searchPlaceholder={t("parties.searchPlaceholder")}
                />
              </div>
              <div>
                <label className="label">{t("filters.createdBy")}</label>
                <CreatorFilterSelect
                  className="mt-1"
                  value={createdByFilterId}
                  onChange={setCreatedByFilterId}
                />
              </div>
              <div>
                <label className="label">Store Type</label>
                <select
                  className="input mt-1 min-h-[44px] w-full rounded-[24px] border border-secondary-200/70 bg-white/80 px-3 py-2 text-sm text-ink-light outline-none focus:border-primary-300 dark:border-slate-800/70 dark:bg-slate-950/40 dark:text-secondary-300"
                  value={storeTypeFilter}
                  onChange={(e) => setStoreTypeFilter(e.target.value)}
                >
                  <option value="all">All stores</option>
                  <option value="physical">Physical store</option>
                  <option value="online">Online store</option>
                </select>
              </div>
              <RefreshButton
                className="min-h-[44px] xl:self-end"
                refreshing={refreshingServices}
                onClick={refreshServices}
                disableWhileRefreshing={false}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
            {statusFilterOptions.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={statusFilter === option.value}
                onClick={() => setStatusFilter(option.value)}
              />
            ))}
          </div>
        </div>

        <div className="px-4 py-4 md:px-6 md:py-6">
          <div className="space-y-3 md:hidden">
            {listLoading && safeServiceList.length === 0 ? (
              <p className="py-4 text-sm text-secondary-500">
                {t("common.loading")}
              </p>
            ) : pagedServices.length === 0 ? (
              <p className="py-4 text-sm text-secondary-500">
                {t("services.noOrders")}
              </p>
            ) : (
              pagedServices.map((order) => {
                const due = Math.max(
                  Number(order.grandTotal || 0) -
                    Number(order.receivedTotal || 0),
                  0,
                );
                const days = getDeliveryDaysLeft(order.deliveryDate);
                const isUrgent =
                  order.status !== "closed" && days !== null && days < 3;
                const attachmentUrls = getServiceAttachmentUrls(order);

                return (
                  <div
                    key={order.id}
                    className={`rounded-[26px] border p-4 text-sm shadow-sm ${
                      isUrgent
                        ? "border-red-200/70 bg-red-50/60 dark:border-red-900/30 dark:bg-red-950/10"
                        : "border-secondary-200/70 bg-white/90 dark:border-slate-800/60 dark:bg-slate-900/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-base font-semibold text-ink">
                            {order.orderNo || order.id.slice(0, 8)}
                          </p>
                          {canManageServices ? (
                            <button
                              type="button"
                              className="transition hover:opacity-75"
                              onClick={() => openStatusDialog(order)}
                            >
                              <StatusBadge status={order.status} locked={isIrdLocked(order)} />
                            </button>
                          ) : (
                            <StatusBadge status={order.status} locked={isIrdLocked(order)} />
                          )}
                          {order.storeType === "online" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              <Globe size={11} /> Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-semibold text-ink-light dark:bg-slate-800 dark:text-secondary-300">
                              <Building2 size={11} /> Physical
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex items-center gap-2 text-sm text-secondary-700">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                            <UserRound size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">
                              {order.Party?.name || order.partyName || "—"}
                            </p>
                            <p className="text-xs text-secondary-500">
                              Created by {getCreatorDisplayName(order)}
                            </p>
                            {(order.Table || order.table || order.tableId) && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                  Table: {order.Table?.name || order.table?.name || order.tableId}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <DeliveryBadge
                            date={order.deliveryDate}
                            isGym={isGym}
                            isClosed={order.status === "closed"}
                            createdAt={order.createdAt}
                          />
                          <PaymentTypeSummary
                            source={order}
                            className="rounded-full bg-secondary-100/80 px-2.5 py-1 dark:bg-slate-800/80"
                            labelClassName="text-[11px] font-semibold"
                            metaClassName="text-[11px]"
                          />
                        </div>
                      </div>

                      <div className="min-w-[96px] rounded-[22px] border border-secondary-200/70 bg-mist/80 p-3 text-right dark:border-slate-800/70 dark:bg-slate-950/40">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary-500">
                          {t("services.summaryTotal")}
                        </p>
                        <p className="mt-2 text-base font-semibold text-ink">
                          {money(order.grandTotal)}
                        </p>
                        {due > 0 && !isIrdCancelled(order) ? (
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center justify-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                            onClick={() => openPayDialog(order)}
                          >
                            {money(due)}
                          </button>
                        ) : (
                          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            {t("common.paid")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end border-t border-secondary-200/70 pt-3 dark:border-slate-800/70">
                      <ActionMenu actions={buildServiceActions(order)} />
                    </div>

                    {attachmentUrls.length > 0 ? (
                      <div className="mt-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">
                          {t("services.attachment")}
                        </p>
                        <AttachmentStrip
                          urls={attachmentUrls}
                          onOpen={openLightbox}
                          size="md"
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-ink">
                <tr>
                  <th className="py-2 pr-4 text-left">
                    {t("services.orderNo")}
                  </th>
                  <th className="py-2 pr-4 text-left">
                    {t("services.customer")}
                  </th>
                  <th className="py-2 pr-4 text-left">
                    {isGym ? "Subscription End Date" : t("services.deliveryDate")}
                  </th>
                  <th className="py-2 pr-4 text-left">
                    {t("services.status")}
                  </th>
                  <th className="py-2 pr-4 text-left">
                    Store
                  </th>
                  <th className="py-2 pr-4 text-left">{t("common.payment")}</th>
                  <th className="py-2 pr-2 text-left">
                    {t("services.attachment")}
                  </th>
                  <th className="py-2 pr-4 text-right">
                    {t("services.grandTotal")}
                  </th>
                  <th className="py-2 pr-4 text-right">
                    {t("services.amountReceived")}
                  </th>
                  <th className="py-2 pr-4 text-right">{t("services.due")}</th>
                  <th className="py-2 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {listLoading && safeServiceList.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-4 text-secondary-500">
                      {t("common.loading")}
                    </td>
                  </tr>
                ) : pagedServices.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-4 text-secondary-500">
                      {t("services.noOrders")}
                    </td>
                  </tr>
                ) : (
                  pagedServices.map((order) => {
                    const days = getDeliveryDaysLeft(order.deliveryDate);
                    const isUrgent =
                      order.status !== "closed" && days !== null && days < 3;
                    const isWarning =
                      order.status !== "closed" &&
                      days !== null &&
                      days >= 3 &&
                      days < 8;
                    const rowClass = isUrgent
                      ? "border-t border-red-200/60 bg-red-50/40 dark:border-red-900/30 dark:bg-red-950/10"
                      : isWarning
                        ? "border-t border-amber-200/60 bg-amber-50/40 dark:border-amber-900/30 dark:bg-amber-950/10"
                        : "border-t border-secondary-200/70";
                    const due = Math.max(
                      Number(order.grandTotal || 0) -
                        Number(order.receivedTotal || 0),
                      0,
                    );
                    const attachmentUrls = getServiceAttachmentUrls(order);

                    return (
                      <tr key={order.id} className={rowClass}>
                        <td className="py-3 pr-4 font-medium text-ink dark:text-slate-200">
                          {order.orderNo || order.id.slice(0, 8)}
                        </td>
                        <td className="py-3 pr-4 text-ink-light dark:text-secondary-300">
                          <div>
                            {order.Party?.name || order.partyName || (
                              <span className="text-secondary-400">—</span>
                            )}
                          </div>
                          <div className="text-xs text-secondary-400">
                            Created by {getCreatorDisplayName(order)}
                          </div>
                          {(order.Table || order.table || order.tableId) && (
                            <div className="mt-1">
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                Table: {order.Table?.name || order.table?.name || order.tableId}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <DeliveryBadge
                            date={order.deliveryDate}
                            isGym={isGym}
                            isClosed={order.status === "closed"}
                            createdAt={order.createdAt}
                          />
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            className="transition hover:opacity-75"
                            onClick={() => openStatusDialog(order)}
                          >
                            <StatusBadge status={order.status} locked={isIrdLocked(order)} />
                          </button>
                        </td>
                        <td className="py-3 pr-4">
                          {order.storeType === "online" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              <Globe size={11} /> Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-semibold text-ink-light dark:bg-slate-800 dark:text-secondary-300">
                              <Building2 size={11} /> Physical
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <PaymentTypeSummary source={order} />
                        </td>
                        <td className="py-3 pr-2">
                          {attachmentUrls.length > 0 ? (
                            <AttachmentStrip
                              urls={attachmentUrls}
                              onOpen={openLightbox}
                              maxVisible={2}
                            />
                          ) : (
                            <span className="text-secondary-300">—</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-ink dark:text-slate-200">
                          {money(order.grandTotal)}
                        </td>
                        <td className="py-3 pr-4 text-right text-emerald-700 dark:text-emerald-400">
                          {money(order.receivedTotal)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {due > 0 && !isIrdCancelled(order) ? (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
                              onClick={() => openPayDialog(order)}
                            >
                              {money(due)}
                            </button>
                          ) : (
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              {t("common.paid")}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <ActionMenu actions={buildServiceActions(order)} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={serviceTotalKnown ? serviceTotal : null}
              hasNext={pagedServices.length >= pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={TABLE_ROW_OPTIONS}
            />
          </div>
        </div>
      </div>
    </>
  );
}
