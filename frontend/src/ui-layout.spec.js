const fs = require("node:fs");
const path = require("node:path");
const { strict: assert } = require("node:assert");
const { test } = require("node:test");

const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("short links are promoted to a top-level authenticated navigation item", () => {
  const header = read("components/header/Header.tsx");
  const shareMenu = read("components/header/NavbarShareMenu.tsx");

  assert.match(header, /link:\s*"\/short-links"/);
  assert.doesNotMatch(shareMenu, /account\/short-links/);
});

test("short link workspace uses a table list with modal creation", () => {
  assert.ok(fs.existsSync(path.join(root, "pages/short-links.tsx")));
  const workspace = read("components/shortLink/ShortLinksWorkspace.tsx");

  assert.match(workspace, /<Table/);
  assert.match(workspace, /<Modal/);
  assert.match(workspace, /openCreate/);
  assert.match(workspace, /href=\{`\/short-links\/\$\{shortLink\.code\}`\}/);
  assert.doesNotMatch(workspace, /shortLinkSidebar/);
  assert.doesNotMatch(workspace, /shortLinkDetails/);
  assert.doesNotMatch(workspace, /selectedCode/);
});

test("short link detail route owns analytics and editing", () => {
  assert.ok(fs.existsSync(path.join(root, "pages/short-links/[code].tsx")));
  const detail = read("components/shortLink/ShortLinkDetailPage.tsx");
  const detailCss = read("components/shortLink/ShortLinksWorkspace.module.css");
  const route = read("pages/short-links/[code].tsx");

  assert.match(route, /ShortLinkDetailPage/);
  assert.match(detail, /shortLinkDetails/);
  assert.match(detail, /statsHeaderPanel/);
  assert.match(detail, /statsOverview/);
  assert.match(detail, /statsDashboardGrid/);
  assert.match(detail, /VisitTrendChart/);
  assert.match(detail, /DistributionPanel/);
  assert.match(detail, /tableClasses\.tablePanel/);
  assert.match(detail, /shortLinkService\.stats/);
  assert.match(detail, /<Modal/);
  assert.match(detail, /openEdit/);
  assert.match(detail, /account\.shortLinks\.edit\.title/);
  assert.doesNotMatch(detail, /MetricBlock/);
  assert.doesNotMatch(detail, /DailyVisitBars/);
  assert.doesNotMatch(detail, /<form\s+className=\{classes\.section\}/);
  assert.doesNotMatch(detail, /account\.shortLinks\.create\.title/);
  assert.match(detailCss, /\.statsHeaderPanel/);
  assert.match(detailCss, /\.statsOverview/);
  assert.match(detailCss, /\.trendBars/);
  assert.match(detailCss, /\.distributionList/);
  assert.match(detailCss, /\.recentVisitsTable/);
  assert.doesNotMatch(detailCss, /\.metricBlock/);
});

test("default app shell and header share a calmer page width", () => {
  const app = read("pages/_app.tsx");
  const header = read("components/header/Header.tsx");
  const headerCss = read("components/header/Header.module.css");
  const globalCss = read("styles/global.css");

  assert.match(app, /<Container\s+size=\{1080\}/);
  assert.match(header, /<Container\s+size=\{1080\}/);
  assert.doesNotMatch(headerCss, /mantine-primary-color/);
  assert.match(globalCss, /scrollbar-width/);
  assert.match(globalCss, /::-webkit-scrollbar/);
});

test("a single AssetComposer powers file/text/link with aligned chat fields", () => {
  const composer = read("components/asset/AssetComposer.tsx");

  // One component handles all three asset kinds.
  assert.match(composer, /room\.asset\.type\.file/);
  assert.match(composer, /room\.asset\.type\.text/);
  assert.match(composer, /room\.asset\.type\.link/);
  // Optional file support + share-style complete-flow hooks.
  assert.match(composer, /uploadFile\?/);
  assert.match(composer, /beforeUpload\?/);
  assert.match(composer, /afterUpload\?/);
  // Chat fields share one height across dropzone, textarea and link input.
  assert.match(composer, /CHAT_FIELD_HEIGHT/);
  assert.match(composer, /compact=\{variant === "chat"\}/);
});

test("share edit reuses the shared AssetComposer with the share complete flow", () => {
  const editPage = read("pages/share/[shareId]/edit.tsx");

  assert.match(editPage, /import AssetComposer from/);
  assert.match(editPage, /<AssetComposer/);
  assert.match(editPage, /shareService\.addAsset/);
  assert.match(editPage, /beforeUpload=\{\(\) => shareService\.revertComplete/);
  assert.match(editPage, /shareService\.completeShare/);
  assert.match(editPage, /reloadShare\(\)/);
  // Old bespoke composer/upload panel are gone.
  assert.doesNotMatch(editPage, /ShareAssetComposer/);
  assert.doesNotMatch(editPage, /EditableUpload/);
});

test("profile menu links directly to admin sections", () => {
  const header = read("components/header/Header.tsx");
  const avatar = read("components/header/ActionAvatar.tsx");
  const adminIndex = read("pages/admin/index.tsx");

  for (const file of [header, avatar]) {
    assert.match(file, /\/admin\/users/);
    assert.match(file, /\/admin\/shares/);
    assert.match(file, /\/admin\/config\/general/);
    assert.doesNotMatch(file, /href="\/admin"/);
  }

  assert.match(adminIndex, /router\.replace\("\/admin\/users"\)/);
  assert.doesNotMatch(adminIndex, /managementOptions/);
});

test("header menu buttons and account tables use the calm shared styling", () => {
  const shareMenu = read("components/header/NavbarShareMenu.tsx");
  const avatar = read("components/header/ActionAvatar.tsx");
  const headerCss = read("components/header/Header.module.css");
  const assetTable = read("components/asset/AssetTable.tsx");
  const fileList = read("components/upload/FileList.tsx");
  const myShares = read("pages/account/shares.tsx");
  const dataTableCss = read("components/core/DataTable.module.css");

  assert.match(shareMenu, /classes\.iconLink/);
  assert.match(avatar, /classes\.iconLink/);
  assert.match(headerCss, /\.iconLink/);
  assert.doesNotMatch(shareMenu, /<ActionIcon>/);
  assert.doesNotMatch(avatar, /<ActionIcon>/);
  assert.match(assetTable, /DataTable\.module\.css/);
  assert.match(fileList, /DataTable\.module\.css/);
  assert.match(myShares, /DataTable\.module\.css/);
  assert.match(dataTableCss, /\.tablePanel/);
  assert.match(dataTableCss, /\.tableRow:hover/);
});

test("asset rows use a unified action menu and preview dialog", () => {
  assert.ok(
    fs.existsSync(path.join(root, "components/asset/AssetActionMenu.tsx")),
  );
  assert.ok(
    fs.existsSync(path.join(root, "components/asset/AssetPreviewDialog.tsx")),
  );

  const assetsPage = read("pages/account/assets.tsx");
  const actionMenu = read("components/asset/AssetActionMenu.tsx");
  const previewDialog = read("components/asset/AssetPreviewDialog.tsx");
  const service = read("services/asset.service.ts");
  const en = read("i18n/translations/en-US.ts");
  const zh = read("i18n/translations/zh-CN.ts");

  assert.match(assetsPage, /AssetActionMenu/);
  assert.doesNotMatch(assetsPage, /<Download\b/);
  assert.match(actionMenu, /<Menu/);
  assert.match(actionMenu, /AssetPreviewDialog/);
  assert.match(actionMenu, /assetService\.createShare/);
  assert.match(actionMenu, /assetService\.createShortLink/);
  assert.match(actionMenu, /assetService\.sendToRoom/);
  assert.match(actionMenu, /assetService\.clone/);
  assert.match(actionMenu, /roomService\s*\.\s*list/);
  assert.match(previewDialog, /asset\.type === "TEXT"/);
  assert.match(previewDialog, /asset\.type === "LINK"/);
  assert.match(previewDialog, /asset\.type === "FILE"/);

  for (const route of [
    "assets/${id}/share",
    "assets/${id}/short-link",
    "assets/${id}/send-to-room",
    "assets/${id}/clone",
  ]) {
    assert.match(service, new RegExp(route.replace(/\$/g, "\\$")));
  }

  for (const key of [
    "account.assets.action.preview",
    "account.assets.action.copy",
    "account.assets.action.createShare",
    "account.assets.action.createShortLink",
    "account.assets.action.sendToRoom",
    "account.assets.action.clone",
    "account.assets.preview.title",
    "account.assets.sendToRoom.title",
  ]) {
    assert.match(en, new RegExp(`"${key}"`));
    assert.match(zh, new RegExp(`"${key}"`));
  }
});

test("my assets page is a tool-style list with search, filters, sort, favorite and tags", () => {
  const page = read("pages/account/assets.tsx");
  const actionMenu = read("components/asset/AssetActionMenu.tsx");
  const service = read("services/asset.service.ts");
  const types = read("types/asset.type.ts");
  const en = read("i18n/translations/en-US.ts");
  const zh = read("i18n/translations/zh-CN.ts");

  // Toolbar: server-side filtering with params
  assert.match(page, /assetService\.list\(/);
  assert.match(page, /useDebouncedValue/);
  assert.match(page, /<Select/);
  assert.match(page, /sort/);
  assert.match(page, /favorite/);
  assert.match(page, /listTags/);

  // Inline favorite + tag management live in the action menu
  assert.match(actionMenu, /TagsInput|manageTags/);
  assert.match(actionMenu, /assetService\.update\(asset\.id,\s*\{\s*favorite/);
  assert.match(actionMenu, /tags:\s*tagValues/);

  // Service: list accepts params, maps tagAssignments, exposes listTags
  assert.match(service, /const list = async \(params/);
  assert.match(service, /params/);
  assert.match(service, /tagAssignments/);
  assert.match(service, /const listTags/);
  assert.match(service, /assets\/tags/);

  // Types: AssetSource union + new Asset fields
  assert.match(types, /AssetSource/);
  assert.match(types, /UPLOAD/);
  assert.match(types, /favorite\?:/);
  assert.match(types, /lastAccessedAt\?:/);
  assert.match(types, /tags\?:/);

  for (const key of [
    "account.assets.filter.search",
    "account.assets.filter.type.all",
    "account.assets.filter.source.all",
    "account.assets.filter.favorite",
    "account.assets.filter.tag.all",
    "account.assets.sort.createdAt_desc",
    "account.assets.sort.createdAt_asc",
    "account.assets.sort.lastAccessedAt_desc",
    "account.assets.sort.name_asc",
    "account.assets.action.favorite",
    "account.assets.action.manageTags",
    "account.assets.tags.modal.title",
    "account.assets.notify.tagsUpdated",
    "account.assets.notify.favorited",
  ]) {
    assert.match(en, new RegExp(`"${key}"`));
    assert.match(zh, new RegExp(`"${key}"`));
  }
});

test("inbox route is the primary reverse-share visitor entry", () => {
  assert.ok(fs.existsSync(path.join(root, "services/inbox.service.ts")));
  assert.ok(fs.existsSync(path.join(root, "pages/inbox/[token].tsx")));
  assert.ok(
    fs.existsSync(path.join(root, "pages/upload/[reverseShareToken].tsx")),
  );

  const inboxRoute = read("pages/inbox/[token].tsx");
  const uploadRoute = read("pages/upload/[reverseShareToken].tsx");
  const inboxService = read("services/inbox.service.ts");

  assert.match(inboxRoute, /inboxToken/);
  assert.match(inboxRoute, /inboxService\s*\.\s*setInbox/);
  assert.match(inboxRoute, /<Upload[\s\S]*isReverseShare/);
  assert.match(inboxRoute, /inboxToken=\{inboxToken\}/);
  assert.match(uploadRoute, /shareService\s*\.\s*setReverseShare/);

  assert.match(inboxService, /api\.post\("inboxes"/);
  assert.match(inboxService, /api\.get\("inboxes"\)/);
  assert.match(inboxService, /api\.get\(`inboxes\/\$\{inboxToken\}`/);
  assert.match(
    inboxService,
    /api\.post\(`inboxes\/\$\{inboxToken\}\/submissions`/,
  );
  assert.match(
    inboxService,
    /api\.post\(`inboxes\/\$\{inboxToken\}\/submissions\/\$\{submissionId\}\/files`/,
  );
  assert.match(
    inboxService,
    /api\.post\(`inbox-submissions\/\$\{submissionId\}\/accept`/,
  );
  assert.match(
    inboxService,
    /api\.post\(`inbox-submissions\/\$\{submissionId\}\/reject`/,
  );
  assert.match(inboxService, /api\.delete\(`inboxes\/\$\{id\}`\)/);
  assert.match(inboxService, /setCookie\("reverse_share_token", inboxToken\)/);
});

test("inbox uploads create pending submissions instead of shares", () => {
  const uploadPage = read("pages/upload/index.tsx");
  const createUpload = read(
    "components/upload/modals/showCreateUploadModal.tsx",
  );

  assert.match(uploadPage, /inboxToken\?:\s*string/);
  assert.match(uploadPage, /inboxService/);
  assert.match(uploadPage, /inboxService\.createSubmission/);
  assert.match(uploadPage, /inboxService\.uploadSubmissionFile/);
  assert.match(uploadPage, /const isInboxUpload = !!inboxToken/);
  assert.match(uploadPage, /if \(isInboxUpload\)/);
  assert.match(uploadPage, /hasFiles:\s*files\.length > 0/);
  assert.match(uploadPage, /inbox\.submission\.created/);
  assert.match(uploadPage, /shareService\.create/);
  assert.match(uploadPage, /shareService\.completeShare/);

  assert.match(createUpload, /isInbox\?:\s*boolean/);
  assert.match(createUpload, /options\.isInbox/);
  assert.match(createUpload, /upload\.modal\.inbox\.submit/);
  assert.match(createUpload, /!options\.isInbox &&/);
});

test("inbox owner page reviews pending submissions", () => {
  const reverseShares = read("pages/account/reverseShares.tsx");
  const actionMenu = read("components/asset/AssetActionMenu.tsx");
  const previewDialog = read("components/asset/AssetPreviewDialog.tsx");
  const en = read("i18n/translations/en-US.ts");
  const zh = read("i18n/translations/zh-CN.ts");

  assert.match(reverseShares, /inboxService/);
  assert.match(reverseShares, /inboxService\.listSubmissions/);
  assert.match(reverseShares, /inboxService\.acceptSubmission/);
  assert.match(reverseShares, /inboxService\.rejectSubmission/);
  assert.match(reverseShares, /acceptSubmission\(submission\.id,\s*true\)/);
  assert.match(reverseShares, /pendingSubmissions/);
  assert.match(reverseShares, /AssetActionMenu/);
  assert.match(reverseShares, /readOnly/);
  assert.match(reverseShares, /account\.reverseShares\.submissions\.pending/);
  assert.match(
    reverseShares,
    /account\.reverseShares\.submissions\.acceptAssets/,
  );
  assert.match(
    reverseShares,
    /account\.reverseShares\.submissions\.acceptShare/,
  );
  assert.match(reverseShares, /account\.reverseShares\.submissions\.reject/);

  assert.match(actionMenu, /readOnly\?:\s*boolean/);
  assert.match(actionMenu, /readOnly &&/);
  assert.match(previewDialog, /allowFileDownload\?:\s*boolean/);

  for (const key of [
    "account.reverseShares.submissions.pending",
    "account.reverseShares.submissions.empty",
    "account.reverseShares.submissions.assets",
    "account.reverseShares.submissions.message",
    "account.reverseShares.submissions.acceptAssets",
    "account.reverseShares.submissions.acceptShare",
    "account.reverseShares.submissions.reject",
    "account.reverseShares.submissions.reject.title",
    "account.reverseShares.submissions.reject.description",
    "account.reverseShares.submissions.notify.acceptedAssets",
    "account.reverseShares.submissions.notify.acceptedShare",
    "account.reverseShares.submissions.notify.rejected",
  ]) {
    assert.match(en, new RegExp(`"${key}"`));
    assert.match(zh, new RegExp(`"${key}"`));
  }
});

test("shared data tables keep action icons aligned and cover admin pages", () => {
  const dataTableCss = read("components/core/DataTable.module.css");
  const reverseShares = read("pages/account/reverseShares.tsx");
  const userTable = read("components/admin/users/ManageUserTable.tsx");
  const shareTable = read("components/admin/shares/ManageShareTable.tsx");
  const shortLinks = read("components/shortLink/ShortLinksWorkspace.tsx");
  const shortLinkCss = read(
    "components/shortLink/ShortLinksWorkspace.module.css",
  );

  assert.match(dataTableCss, /\.actions/);
  assert.match(dataTableCss, /min-width:\s*132px/);
  assert.doesNotMatch(dataTableCss, /width:\s*1%/);
  for (const file of [reverseShares, userTable, shareTable, shortLinks]) {
    assert.match(file, /DataTable\.module\.css/);
    assert.match(file, /tableClasses\.tablePanel/);
    assert.match(file, /tableClasses\.actionCell/);
  }
  assert.match(shortLinkCss, /overflow-wrap:\s*anywhere/);
});

test("admin user passwords are changed from a dedicated row action dialog", () => {
  const userTable = read("components/admin/users/ManageUserTable.tsx");
  const updateUser = read("components/admin/users/showUpdateUserModal.tsx");
  const passwordModal = read(
    "components/admin/users/showChangeUserPasswordModal.tsx",
  );
  const en = read("i18n/translations/en-US.ts");
  const zh = read("i18n/translations/zh-CN.ts");

  assert.match(userTable, /showChangeUserPasswordModal/);
  assert.match(userTable, /<KeyRound\b/);
  assert.match(
    userTable,
    /showChangeUserPasswordModal\(\s*modals,\s*user,\s*getUsers,\s*\)/,
  );

  assert.doesNotMatch(updateUser, /Accordion/);
  assert.doesNotMatch(updateUser, /PasswordInput/);
  assert.doesNotMatch(updateUser, /change-password/);

  assert.match(passwordModal, /PasswordInput/);
  assert.match(passwordModal, /userService\s*\.\s*update\(user\.id,\s*\{/);
  assert.match(passwordModal, /password:\s*values\.password/);
  assert.match(passwordModal, /admin\.users\.edit\.password\.title/);
  assert.match(passwordModal, /ModalForm\.module\.css/);

  for (const key of [
    "admin.users.edit.password.action",
    "admin.users.edit.password.title",
  ]) {
    assert.match(en, new RegExp(`"${key}"`));
    assert.match(zh, new RegExp(`"${key}"`));
  }
});

test("share and short link dialogs use the shared flat modal form styling", () => {
  const modalCss = read("components/core/ModalForm.module.css");
  const shareInfo = read("components/share/showShareInformationsModal.tsx");
  const createUpload = read(
    "components/upload/modals/showCreateUploadModal.tsx",
  );
  const reverseShare = read(
    "components/share/modals/showCreateReverseShareModal.tsx",
  );
  const shortLinkDetail = read("components/shortLink/ShortLinkDetailPage.tsx");

  assert.match(modalCss, /\.modalStack/);
  assert.match(modalCss, /\.section/);
  assert.match(modalCss, /\.createShareGrid/);
  assert.match(modalCss, /\.flatSection/);
  assert.match(modalCss, /\.previewBar/);
  assert.match(modalCss, /\.fieldGrid/);
  assert.match(modalCss, /\.footer/);

  for (const file of [shareInfo, createUpload, reverseShare, shortLinkDetail]) {
    assert.match(file, /ModalForm\.module\.css/);
    assert.match(file, /modalClasses\.modalStack/);
    assert.match(file, /modalClasses\.footer/);
  }

  assert.match(createUpload, /modalClasses\.createShareGrid/);
  assert.match(createUpload, /modalClasses\.flatSection/);
  assert.match(createUpload, /modalClasses\.previewBar/);
  assert.match(createUpload, /<ActionIcon/);
  assert.match(createUpload, /color="gray"/);
  assert.doesNotMatch(createUpload, /Accordion/);
  assert.doesNotMatch(createUpload, /variant="separated"/);
  assert.doesNotMatch(createUpload, /leftSection=\{<RefreshCw/);
});

test("create share dialog treats files text and links as first-class content tabs", () => {
  const createUpload = read(
    "components/upload/modals/showCreateUploadModal.tsx",
  );
  const uploadPage = read("pages/upload/index.tsx");
  const modalCss = read("components/core/ModalForm.module.css");

  assert.match(createUpload, /<Tabs/);
  assert.match(createUpload, /activeContentTab/);
  assert.match(createUpload, /pendingTextAssets/);
  assert.match(createUpload, /pendingLinkAssets/);
  assert.match(createUpload, /addPendingTextAsset/);
  assert.match(createUpload, /addPendingLinkAsset/);
  assert.match(createUpload, /modalClasses\.contentTabs/);
  assert.match(createUpload, /modalClasses\.pendingAssetList/);
  assert.match(createUpload, /upload\.modal\.content\.files/);
  assert.match(createUpload, /upload\.modal\.content\.text/);
  assert.match(createUpload, /upload\.modal\.content\.link/);
  assert.doesNotMatch(createUpload, /accordion\./);

  assert.match(uploadPage, /pendingAssets/);
  assert.match(uploadPage, /shareService\.addAsset/);
  assert.match(uploadPage, /Promise\.all\(assetUploadPromises\)/);
  assert.match(modalCss, /\.contentTabs/);
  assert.match(modalCss, /\.pendingAssetList/);
  assert.match(modalCss, /\.assetSummaryRow/);
});

test("activity log pages and nav surface user and admin events", () => {
  const accountActivity = read("pages/account/activity.tsx");
  const adminActivity = read("pages/admin/activity.tsx");
  const service = read("services/activity.service.ts");
  const types = read("types/activity.type.ts");
  const avatar = read("components/header/ActionAvatar.tsx");
  const en = read("i18n/translations/en-US.ts");
  const zh = read("i18n/translations/zh-CN.ts");

  // Types match the backend contract
  assert.match(types, /ActivityEvent/);
  assert.match(types, /ActivityFilters/);
  assert.match(types, /actorId/);
  assert.match(types, /targetType/);
  assert.doesNotMatch(types, /ipHash/);

  // Service wraps both endpoints and passes filters as params
  assert.match(service, /const list = async/);
  assert.match(service, /const listAll = async/);
  assert.match(service, /api\.get\("activities"/);
  assert.match(service, /api\.get\("activities\/all"/);
  assert.match(service, /params/);

  // Account page: filterable table of the current user's events
  assert.match(accountActivity, /activityService\.list/);
  assert.match(accountActivity, /<Table/);
  assert.match(accountActivity, /<Select/);
  assert.match(accountActivity, /CenterLoader/);
  assert.match(accountActivity, /tableClasses\.tablePanel/);
  assert.match(accountActivity, /account\.activity\.title/);

  // Admin page: all events, guarded by isAdmin
  assert.match(adminActivity, /activityService\.listAll/);
  assert.match(adminActivity, /isAdmin/);
  assert.match(adminActivity, /<Table/);
  assert.match(adminActivity, /<Select/);
  assert.match(adminActivity, /admin\.activity\.title/);

  // Profile menu exposes both routes
  assert.match(avatar, /\/account\/activity/);
  assert.match(avatar, /\/admin\/activity/);

  for (const key of [
    "account.activity.title",
    "account.activity.table.time",
    "account.activity.table.action",
    "account.activity.table.target",
    "account.activity.table.detail",
    "account.activity.filter.action",
    "account.activity.filter.target",
    "account.activity.filter.all",
    "account.activity.empty",
    "admin.activity.title",
    "admin.button.activity",
  ]) {
    assert.match(en, new RegExp(`"${key}"`));
    assert.match(zh, new RegExp(`"${key}"`));
  }
});

test("short link status controls use radios and differentiated table badges", () => {
  const detail = read("components/shortLink/ShortLinkDetailPage.tsx");
  const workspace = read("components/shortLink/ShortLinksWorkspace.tsx");

  assert.match(detail, /Radio\.Group/);
  assert.match(detail, /name="short-link-status"/);
  assert.equal((detail.match(/<SegmentedControl/g) ?? []).length, 1);
  assert.match(workspace, /shortLink\.isActive\s*\?\s*"green"\s*:\s*"gray"/);
  assert.match(workspace, /shortLink\.isActive\s*\?\s*"light"\s*:\s*"outline"/);
});
