export default {
  // Navbar
  "navbar.upload": "Upload",
  "navbar.rooms": "Rooms",
  "navbar.signin": "Sign in",
  "navbar.home": "Home",
  "navbar.signup": "Sign up",
  "navbar.contentAndSharing": "Content & sharing",

  "navbar.links.shares": "Independent shares",
  "navbar.links.assets": "My assets",
  "navbar.links.shortLinks": "Short links",
  "navbar.links.reverse": "Inboxes",

  "navbar.avatar.account": "My account",
  "navbar.avatar.admin": "Administration",
  "navbar.avatar.signout": "Sign out",
  // END navbar

  // /
  "home.title": "A <h>self-hosted</h> file sharing platform.",

  "home.description":
    "Do you really want to give your personal files in the hand of third parties like WeTransfer?",
  "home.bullet.a.name": "Self-Hosted",
  "home.bullet.a.description": "Host Share on your own machine.",
  "home.bullet.b.name": "Privacy",
  "home.bullet.b.description":
    "Your files are yours and will never be accessed by third parties.",
  "home.bullet.c.name": "No annoying file size limit",
  "home.bullet.c.description":
    "Upload files as big as you want. Only your hard drive will be your limit.",

  "home.button.start": "Get started",
  "home.button.source": "Source code",
  // END /

  // /auth/signin
  "signin.title": "Welcome back",
  "signin.description": "You don't have an account yet?",
  "signin.button.signup": "Sign up",
  "signin.input.email-or-username": "Email or username",
  "signin.input.email-or-username.placeholder": "Your email or username",
  "signin.input.password": "Password",
  "signin.input.password.placeholder": "Your password",
  "signin.button.submit": "Sign in",
  "signIn.notify.totp-required.title": "Two-factor authentication required",
  "signIn.notify.totp-required.description":
    "Please enter your two-factor authentication code",
  "signIn.oauth.or": "OR",
  "signIn.oauth.signInWith": "Sign in with",
  "signIn.oauth.github": "GitHub",
  "signIn.oauth.google": "Google",
  "signIn.oauth.microsoft": "Microsoft",
  "signIn.oauth.discord": "Discord",
  "signIn.oauth.oidc": "OpenID",

  // END /auth/signin

  // /auth/signup
  "signup.title": "Create an account",
  "signup.description": "Already have an account?",
  "signup.button.signin": "Sign in",
  "signup.input.username": "Username",
  "signup.input.username.placeholder": "Your username",
  "signup.input.email": "Email",
  "signup.input.email.placeholder": "Your email",
  "signup.button.submit": "Let's get started",

  // END /auth/signup

  // /auth/totp
  "totp.title": "TOTP Authentication",
  "totp.button.signIn": "Sign in",

  // END /auth/totp

  // /auth/reset-password
  "resetPassword.title": "Forgot your password?",
  "resetPassword.description": "Enter your email to reset your password.",
  "resetPassword.notify.success":
    "A message with a link to reset your password has been sent if the provided email exists.",
  "resetPassword.button.back": "Back to sign in page",
  "resetPassword.text.resetPassword": "Reset password",
  "resetPassword.text.enterNewPassword": "Enter your new password",
  "resetPassword.input.password": "New password",
  "resetPassword.notify.passwordReset":
    "Your password has been successfully reset.",

  // /account
  "account.title": "My account",

  "account.card.info.title": "Account info",
  "account.card.info.username": "Username",
  "account.card.info.email": "Email",
  "account.notify.info.success": "Account updated successfully",

  "account.card.password.title": "Password",
  "account.card.password.old": "Old password",
  "account.card.password.new": "New password",
  "account.card.password.noPasswordSet":
    "You do not have a password set. To sign in using your email and password, you need to create a password.",
  "account.notify.password.success": "Password changed successfully",

  "account.card.oauth.title": "Social login",
  "account.card.oauth.github": "GitHub",
  "account.card.oauth.google": "Google",
  "account.card.oauth.microsoft": "Microsoft",
  "account.card.oauth.discord": "Discord",
  "account.card.oauth.oidc": "OpenID",
  "account.card.oauth.link": "Link",
  "account.card.oauth.unlink": "Unlink",
  "account.card.oauth.unlinked": "Unlinked",
  "account.modal.unlink.title": "Unlink account",
  "account.modal.unlink.description":
    "Unlinking your social accounts may cause you to lose your account if you don't remember your login credentials",
  "account.notify.oauth.unlinked.success": "Unlinked successfully",

  "account.card.security.title": "Security",
  "account.card.security.totp.enable.description":
    "Enter your current password to start enabling TOTP",
  "account.card.security.totp.disable.description":
    "Enter your current password to disable TOTP",
  "account.card.security.totp.button.start": "Start",
  "account.modal.totp.title": "Enable TOTP",
  "account.modal.totp.step1": "Step 1: Add your authenticator",
  "account.modal.totp.step2": "Step 2: Validate your code",
  "account.modal.totp.enterManually": "Enter manually",
  "account.modal.totp.code": "Code",
  "common.button.clickToCopy": "Click to copy",
  "common.button.showQRCode": "Show QR code",
  "account.modal.totp.verify": "Verify",
  "account.notify.totp.disable": "TOTP disabled successfully",
  "account.notify.totp.enable": "TOTP enabled successfully",

  "account.card.language.title": "Language",
  "account.card.language.description":
    "The project is translated by the community. Some languages might be incomplete.",
  "account.card.color.title": "Color scheme",

  // ThemeSwitcher.tsx
  "account.theme.dark": "Dark",
  "account.theme.light": "Light",
  "account.theme.system": "System",

  "account.button.delete": "Delete Account",
  "account.modal.delete.title": "Delete Account",
  "account.modal.delete.description":
    "Do you really want to delete your account including all your active shares?",
  // END /account

  // /account/shares
  "account.shares.title": "Independent shares",
  "account.shares.title.empty": "No independent shares yet",
  "account.shares.description.empty":
    "Create one by uploading content or from your asset library.",
  "account.shares.button.create": "Create one",

  "account.shares.info.title": "Share informations",
  "account.shares.button.edit": "Add/Remove Files",
  "account.shares.table.id": "ID",
  "account.shares.table.name": "Name",
  "account.shares.table.description": "Description",
  "account.shares.table.visitors": "Visitors",
  "account.shares.table.expiresAt": "Expires on",
  "account.shares.table.createdAt": "Created on",
  "account.shares.table.size": "Size",
  "account.shares.table.password-protected": "Password protected",
  "account.shares.table.visitor-count": "{count} of {max}",
  "account.shares.table.expiry-never": "Never",

  "account.shares.modal.share-informations": "Share informations",
  "account.shares.modal.share-link": "Share link",
  "account.shares.modal.edit.password.keep":
    "Leave blank to keep the current password",
  "account.shares.modal.edit.password.remove": "Remove password protection",

  "account.shares.modal.delete.title": "Delete share: {share}",
  "account.shares.modal.delete.description":
    "Do you really want to delete this share?",

  // END /account/shares

  // /account/assets
  "account.assets.title": "My assets",
  "account.assets.title.empty": "No assets yet",
  "account.assets.description.empty": "Choose a file, paste content, or type a link to save your first asset.",
  "account.assets.title.noResults": "No matching assets",
  "account.assets.description.noResults": "Try another search or clear the filters.",
  "account.assets.filter.clear": "Clear filters",
  "account.shortLinks.quick-url": "Paste a URL to create a short link",
  "account.shortLinks.quick-next": "Set up short link",
  "account.shortLinks.error.drop-url": "Drop a single web URL here. Upload files from the Upload page.",
  "shortLinkAccess.title": "Open short link",
  "shortLinkAccess.unavailable": "This short link is unavailable.",
  "shortLinkAccess.disabled": "The owner has disabled this short link.",
  "shortLinkAccess.expired": "This short link has expired.",
  "shortLinkAccess.limit": "This short link has reached its access limit.",
  "shortLinkAccess.signInRequired": "Sign in to open this short link.",
  "shortLinkAccess.signIn": "Sign in",
  "shortLinkAccess.password": "Password",
  "shortLinkAccess.open": "Open link",
  "shortLinkAccess.denied": "Access could not be verified. Check the password or access rules and try again.",
  "account.shortLinks.remove-password": "Remove current password when saving",
  "account.shortLinks.keep-password": "Keep current password",
  "account.shortLinks.password-active": "A password is currently required. Leave the field empty to keep it, or enter a new one.",
  "account.assets.type.file": "File",
  "account.assets.type.text": "Text",
  "account.assets.type.link": "Link",
  "account.assets.form.file": "File",
  "account.assets.form.content": "Text",
  "account.assets.form.url": "URL",
  "account.assets.table.type": "Type",
  "account.assets.table.value": "Value",
  "account.assets.table.createdAt": "Created on",
  "account.assets.table.size": "Size",
  "account.assets.modal.delete.title": "Delete asset",
  "account.assets.modal.delete.description":
    "Do you really want to delete this asset?",
  "account.assets.notify.created": "Asset created",
  "account.assets.notify.deleted": "Asset deleted",
  "account.assets.notify.cloned": "Asset copied",
  "account.assets.notify.shareCreated": "Share created",
  "account.assets.notify.shortLinkCreated": "Short link created",
  "account.assets.notify.sentToRoom": "Asset sent to room",
  "account.assets.notify.savedToLibrary": "Saved to your asset library",
  "account.assets.action.more": "Asset actions",
  "account.assets.action.preview": "Preview",
  "account.assets.action.copy": "Copy content or link",
  "account.assets.action.createShare": "Create share",
  "account.assets.action.createShortLink": "Create short link",
  "account.assets.action.sendToRoom": "Send to room",
  "account.assets.action.saveToLibrary": "Save to asset library",
  "account.assets.action.clone": "Copy asset",
  "account.assets.preview.title": "Preview asset",
  "account.assets.preview.file.unsupported":
    "Preview is unavailable for this file type.",
  "account.assets.sendToRoom.title": "Send asset to room",
  "account.assets.sendToRoom.select": "Room",
  "account.assets.sendToRoom.empty": "Create a room before sending assets.",
  "account.assets.source.upload": "Upload",
  "account.assets.source.share": "Share",
  "account.assets.source.room": "Room",
  "account.assets.source.inbox": "Inbox",
  "account.assets.filter.search": "Search assets",
  "account.assets.filter.type.all": "All types",
  "account.assets.filter.source.all": "All sources",
  "account.assets.filter.favorite": "Favorites only",
  "account.assets.filter.tag.all": "All tags",
  "account.assets.sort.createdAt_desc": "Newest first",
  "account.assets.sort.createdAt_asc": "Oldest first",
  "account.assets.sort.lastAccessedAt_desc": "Recently used",
  "account.assets.sort.name_asc": "Name (A–Z)",
  "account.assets.action.favorite": "Toggle favorite",
  "account.assets.action.manageTags": "Manage tags",
  "account.assets.tags.modal.title": "Manage tags",
  "account.assets.tags.modal.label": "Tags",
  "account.assets.tags.modal.placeholder": "Add a tag and press Enter",
  "account.assets.notify.tagsUpdated": "Tags updated",
  "account.assets.notify.favorited": "Favorite updated",

  // END /account/assets

  // /account/activity
  "account.activity.title": "My activity",
  "account.activity.table.time": "Time",
  "account.activity.table.action": "Action",
  "account.activity.table.target": "Target",
  "account.activity.table.detail": "Detail",
  "account.activity.filter.action": "Action",
  "account.activity.filter.target": "Target type",
  "account.activity.filter.all": "All",
  "account.activity.empty": "No activity yet.",
  "account.activity.action.asset.create": "Created asset",
  "account.activity.action.asset.delete": "Deleted asset",
  "account.activity.action.asset.clone": "Copied asset",
  "account.activity.action.asset.save": "Saved asset to library",
  "account.activity.action.share.create": "Created share",
  "account.activity.action.share.complete": "Completed share",
  "account.activity.action.share.delete": "Deleted share",
  "account.activity.action.shortLink.create": "Created short link",
  "account.activity.action.shortLink.visit": "Short link visited",
  "account.activity.action.shortLink.delete": "Deleted short link",
  "account.activity.action.inbox.create": "Created inbox",
  "account.activity.action.inbox.submission": "Inbox submission received",
  "account.activity.action.inbox.accept": "Accepted submission",
  "account.activity.action.inbox.reject": "Rejected submission",
  "account.activity.target.asset": "Asset",
  "account.activity.target.share": "Share",
  "account.activity.target.shortLink": "Short link",
  "account.activity.target.inbox": "Inbox",
  "account.activity.target.inboxSubmission": "Inbox submission",
  // END /account/activity

  // /account/short-links
  "account.shortLinks.title": "Short links",
  "account.shortLinks.count": "links",
  "account.shortLinks.create.title": "Create short link",
  "account.shortLinks.create": "Create link",
  "account.shortLinks.type.url": "URL",
  "account.shortLinks.type.internal": "Internal path",
  "account.shortLinks.targetPicker.label": "Choose an existing target",
  "account.shortLinks.targetPicker.rooms": "Shared rooms",
  "account.shortLinks.targetPicker.shares": "Independent shares",
  "account.shortLinks.targetPicker.placeholder": "Search rooms or shares",
  "account.shortLinks.targetPicker.empty": "No rooms or shares available",
  "account.shortLinks.targetPicker.loadFailed": "Some targets could not be loaded. You can enter a path manually.",
  "account.shortLinks.targetPicker.path": "Internal path",
  "account.shortLinks.error.target": "Enter a valid URL or internal path",
  "account.shortLinks.filter.search": "Search code, title, or target",
  "account.shortLinks.filter.status": "Filter by status",
  "account.shortLinks.filter.type": "Filter by type",
  "account.shortLinks.filter.all": "All",
  "account.shortLinks.filter.clear": "Clear filters",
  "account.shortLinks.filter.empty": "No matching short links.",
  "account.shortLinks.form.target": "Target",
  "account.shortLinks.form.title": "Title",
  "account.shortLinks.form.code": "Custom code",
  "account.shortLinks.list.title": "My short links",
  "account.shortLinks.empty": "No short links yet.",
  "account.shortLinks.table.code": "Code",
  "account.shortLinks.table.target": "Target",
  "account.shortLinks.table.visits": "Visits",
  "account.shortLinks.table.status": "Status",
  "account.shortLinks.status.active": "Active",
  "account.shortLinks.status.disabled": "Disabled",
  "account.shortLinks.status.expired": "Expired",
  "account.shortLinks.status.limit": "View limit reached",
  "account.shortLinks.action.enable": "Enable",
  "account.shortLinks.action.disable": "Disable",
  "account.shortLinks.edit.title": "Edit selected link",
  "account.shortLinks.stats.open": "View stats",
  "account.shortLinks.stats.title": "Analytics",
  "account.shortLinks.stats.empty": "Select a short link to view analytics.",
  "account.shortLinks.stats.totalVisits": "Total visits",
  "account.shortLinks.stats.uniqueVisitors": "Unique visitors",
  "account.shortLinks.stats.lastVisit": "Last visit",
  "account.shortLinks.stats.noVisits": "No visits recorded yet.",
  "account.shortLinks.stats.byDay": "Visits by day",
  "account.shortLinks.stats.byReferer": "Traffic sources",
  "account.shortLinks.stats.byUserAgent": "User agents",
  "account.shortLinks.stats.recent": "Recent visits",
  "account.shortLinks.stats.visitTime": "Time",
  "account.shortLinks.stats.referer": "Referer",
  "account.shortLinks.stats.userAgent": "User agent",
  "account.shortLinks.notify.created": "Short link created",
  "account.shortLinks.notify.updated": "Short link updated",
  "account.shortLinks.notify.enabled": "Short link enabled",
  "account.shortLinks.notify.disabled": "Short link disabled",
  "account.shortLinks.notify.deleted": "Short link deleted",
  "account.shortLinks.modal.delete.title": "Delete short link",
  "account.shortLinks.modal.delete.description":
    "Do you really want to delete short link {code} and its visit logs?",

  // END /account/short-links

  // /rooms
  "room.title": "Rooms",
  "room.auth.title": "Sign in to continue",
  "room.auth.description":
    "Private and shared rooms are available to signed-in users.",
  "room.private.title": "Private room",
  "room.private.subtitle": "Only you can see this room",
  "room.sync.reconnecting": "Reconnecting…",
  "room.filter.all": "All",
  "room.role.owner": "Owner",
  "room.role.visitor": "Visitor",
  "room.private.badge": "Private",
  "room.asset.type.file": "File",
  "room.asset.type.text": "Text",
  "room.asset.type.link": "Link",
  "room.asset.create": "Add",
  "content.target": "Adding to: {target}",
  "content.target.upload": "Independent share",
  "content.target.inbox": "Inbox submission",
  "content.continue": "Review share settings",
  "content.save-library": "Save to library",
  "content.pending": "{count} pending",
  "content.input": "Text or link",
  "content.placeholder": "Type or paste text, a link, or an image here",
  "content.choose-file": "Choose files",
  "content.paste": "Paste",
  "content.shortcut": "Paste text, links, or images with {shortcut}",
  "content.drop": "Drop to add to the preview",
  "content.type": "Content type",
  "content.value": "Content",
  "content.detected": "Detected as {type}; review before adding",
  "content.error.size": "File exceeds the {max} limit",
  "content.error.empty": "Enter content before adding",
  "content.error.link": "Enter one valid http or https URL",
  "content.error.clipboard": "Clipboard access failed. Use the paste shortcut instead.",
  "content.error.unsupported": "This dropped content is not supported",
  "content.error.submit": "Could not add this content. Your draft is still here.",
  "room.asset.file": "File",
  "room.asset.file.choose": "Choose files",
  "room.asset.file.empty": "No files selected",
  "room.asset.content": "Text",
  "room.asset.url": "URL",
  "room.assets.empty": "No room items yet.",
  "room.assets.new": "{count} new items · Jump to latest",
  "room.assets.count": "{count} items",
  "room.assets.table.type": "Type",
  "room.assets.table.value": "Value",
  "room.assets.table.createdAt": "Created on",
  "room.assets.modal.delete.title": "Delete room item",
  "room.assets.modal.delete.description":
    "This room item will be permanently removed.",
  "room.rooms.create.title": "Create room",
  "room.rooms.create": "Create room",
  "room.rooms.name": "Room name",
  "room.rooms.passcode": "Passcode",
  "room.rooms.title": "My rooms",
  "room.rooms.manage": "Room management",
  "room.rooms.visited": "Visited rooms",
  "room.rooms.visited.empty": "No visited rooms yet.",
  "room.rooms.empty": "No rooms yet.",
  "room.rooms.count": "rooms",
  "room.rooms.id": "Room ID",
  "room.rooms.status": "Status",
  "room.rooms.items": "Items",
  "room.rooms.protected": "Protected",
  "room.rooms.open": "Open",
  "room.rooms.delete.title": "Delete room",
  "room.rooms.delete.description":
    "Room {room} and its items will be permanently deleted.",
  "room.rooms.edit.title": "Edit room",
  "room.rooms.editor.title": "Room",
  "room.rooms.editor.empty": "Create or select a room to add items.",
  "room.rooms.select": "Select a room",
  "room.rooms.passcode.keep": "Leave blank to keep the current passcode.",
  "room.rooms.passcode.remove": "Remove passcode",
  "room.notify.asset-created": "Room item added",
  "room.notify.asset-deleted": "Room item deleted",
  "room.notify.room-created": "Room created",
  "room.notify.room-deleted": "Room deleted",
  "room.notify.room-updated": "Room updated",
  "room.room.title": "Room",
  "room.room.locked.title": "Passcode required",
  "room.room.passcode": "Passcode",
  "room.room.unlock": "Unlock room",
  "room.room.notify.verified": "Room unlocked",

  // END /rooms

  // /account/reverseShares
  "account.reverseShares.title": "Inboxes",
  "account.reverseShares.description":
    "Inboxes let external users submit files, text, and links for your review.",

  "account.reverseShares.title.empty": "No inboxes yet",
  "account.reverseShares.description.empty":
    "Create an inbox link to receive content for review.",

  // showCreateReverseShareModal.tsx
  "account.reverseShares.modal.title": "Create inbox",
  "account.reverseShares.modal.details": "Inbox details",
  "account.reverseShares.modal.name": "Inbox name",
  "account.reverseShares.modal.description": "Instructions for submitters",
  "account.reverseShares.modal.expiration.label": "Expiration",
  "account.reverseShares.modal.expiration.minute-singular": "Minute",
  "account.reverseShares.modal.expiration.minute-plural": "Minutes",
  "account.reverseShares.modal.expiration.hour-singular": "Hour",
  "account.reverseShares.modal.expiration.hour-plural": "Hours",
  "account.reverseShares.modal.expiration.day-singular": "Day",
  "account.reverseShares.modal.expiration.day-plural": "Days",
  "account.reverseShares.modal.expiration.week-singular": "Week",
  "account.reverseShares.modal.expiration.week-plural": "Weeks",
  "account.reverseShares.modal.expiration.month-singular": "Month",
  "account.reverseShares.modal.expiration.month-plural": "Months",
  "account.reverseShares.modal.expiration.year-singular": "Year",
  "account.reverseShares.modal.expiration.year-plural": "Years",

  "account.reverseShares.modal.max-size.label": "Max size per submission",
  "account.reverseShares.modal.mode.label": "Submission mode",
  "account.reverseShares.modal.mode.ongoing": "Ongoing collection",
  "account.reverseShares.modal.mode.once": "One submission",
  "account.reverseShares.modal.reviewNotice":
    "Submissions wait for your review and remain private while pending.",

  "account.reverseShares.modal.send-email": "Send email notifications",
  "account.reverseShares.modal.send-email.description":
    "Sends you an email notification when a share is created with this reverse share link.",

  "account.reverseShares.modal.simplified": "Simple mode",
  "account.reverseShares.modal.simplified.description":
    "Show a shorter form to people submitting content.",

  "account.reverseShares.modal.public-access":
    "Allow public links after approval",
  "account.reverseShares.modal.public-access.description":
    "Applies only when you accept a submission as a share.",

  "account.reverseShares.modal.max-use.label": "Max uses",
  "account.reverseShares.modal.max-use.description":
    "Each submission uses one of these slots.",
  "account.reverseShare.never-expires": "This inbox will never expire.",
  "account.reverseShare.expires-on":
    "This inbox will expire on {expiration}.",

  "account.reverseShares.table.unnamed": "Unnamed inbox",
  "account.reverseShares.table.no-shares": "No accepted shares",
  "account.reverseShares.table.count.singular": "share",
  "account.reverseShares.table.count.plural": "shares",
  "account.reverseShares.table.shares": "Inbox",
  "account.reverseShares.table.remaining": "Remaining uses",
  "account.reverseShares.table.max-size": "Max size per submission",
  "account.reverseShares.table.expires": "Expires at",

  "account.reverseShares.submissions.pending": "Pending submissions",
  "account.reverseShares.submissions.empty": "No pending submissions.",
  "account.reverseShares.submissions.assets": "Assets",
  "account.reverseShares.submissions.message": "Message",
  "account.reverseShares.submissions.submittedAt": "Submitted at",
  "account.reverseShares.submissions.noMessage": "No message",
  "account.reverseShares.submissions.acceptAssets": "Save to library",
  "account.reverseShares.submissions.approve": "Approve",
  "account.reverseShares.submissions.acceptRoom": "Add to room",
  "account.reverseShares.submissions.notify.acceptedRoom": "Submission added to room",
  "account.reverseShares.submissions.acceptShare": "Create share",
  "account.reverseShares.submissions.reject": "Reject",
  "account.reverseShares.submissions.reject.title": "Reject submission",
  "account.reverseShares.submissions.reject.description":
    "Reject this submission and delete its uploaded assets?",
  "account.reverseShares.submissions.notify.acceptedAssets":
    "Submission saved to your library",
  "account.reverseShares.submissions.notify.acceptedShare":
    "Submission received as a share",
  "account.reverseShares.submissions.notify.rejected": "Submission rejected",

  "account.reverseShares.modal.reverse-share-link": "Inbox link",

  "account.reverseShares.modal.delete.title": "Delete inbox",
  "account.reverseShares.modal.delete.description":
    "Do you really want to delete this inbox? If you do, the associated shares will be deleted as well.",

  // END /account/reverseShares

  // /admin
  "admin.title": "Administration",
  "admin.button.users": "User management",
  "admin.button.shares": "Share management",
  "admin.button.config": "Configuration",
  "admin.button.activity": "Activity log",
  "admin.version": "Version",
  // END /admin

  // /admin/activity
  "admin.activity.title": "Activity log",
  "admin.activity.table.actor": "Actor",
  // END /admin/activity

  // /admin/users
  "admin.users.title": "User management",
  "admin.users.table.username": "Username",
  "admin.users.table.email": "Email",
  "admin.users.table.admin": "Admin",

  "admin.users.edit.update.title": "Edit user: {username}",
  "admin.users.edit.update.admin-privileges": "Admin privileges",
  "admin.users.edit.password.action": "Change password",
  "admin.users.edit.password.title": "Change password: {username}",
  "admin.users.edit.update.change-password.title": "Change password",
  "admin.users.edit.update.change-password.field": "New password",
  "admin.users.edit.update.change-password.button": "Save new password",
  "admin.users.edit.update.notify.password.success":
    "Password changed successfully",

  "admin.users.edit.delete.title": "Delete user: {username} ?",
  "admin.users.edit.delete.description":
    "Do you really want to delete this user and all their shares?",

  // showCreateUserModal.tsx
  "admin.users.modal.create.title": "Create user",
  "admin.users.modal.create.username": "Username",
  "admin.users.modal.create.email": "Email",
  "admin.users.modal.create.password": "Password",
  "admin.users.modal.create.manual-password": "Set password manually",
  "admin.users.modal.create.manual-password.description":
    "If not checked, the user will receive an email with a link to set their password.",
  "admin.users.modal.create.admin": "Admin privileges",
  "admin.users.modal.create.admin.description":
    "If checked, the user will be able to access the admin panel.",

  // END /admin/users

  // /admin/shares
  "admin.shares.title": "Share management",
  "admin.shares.diskUsage": "Disk Usage",
  "admin.shares.table.id": "Share ID",
  "admin.shares.table.username": "Creator",
  "admin.shares.table.visitors": "Visitors",
  "admin.shares.table.expires": "Expires on",
  "admin.shares.table.deletes": "Deletes on",

  "admin.shares.edit.delete.title": "Delete share: {id}",
  "admin.shares.edit.delete.description":
    "Do you really want to delete this share?",

  // END /admin/shares

  // /upload
  "upload.title": "Upload",

  "upload.notify.confirm-leave":
    "Are you sure you want to leave this page? Your upload will be canceled.",
  "upload.notify.generic-error":
    "An error occurred while finishing your share.",
  "upload.notify.count-failed": "{count} files failed to upload. Trying again.",
  "upload.reverse-share.error.invalid.title": "Invalid reverse share link",
  "upload.reverse-share.error.invalid.description":
    "This link has no remaining uses or is invalid.",

  // Dropzone.tsx
  "upload.dropzone.title": "Upload files",
  "upload.dropzone.description":
    "Drag'n'drop files here to start your share or 'Ctrl+V' to upload text content from the clipboard. We only accept files up to {maxSize} in total.",
  "upload.dropzone.notify.file-too-big":
    "Your files exceed the maximum share size of {maxSize}.",

  // FileList.tsx
  "upload.filelist.name": "Name",
  "upload.filelist.size": "Size",

  // showCreateUploadModal.tsx
  "upload.modal.title": "Create Share",
  "upload.modal.link.error.invalid":
    "Can only contain letters, numbers, underscores, and hyphens",
  "upload.modal.link.error.taken": "This link is already in use",
  "upload.modal.not-signed-in": "You're not signed in",
  "upload.modal.not-signed-in-description":
    "You will be unable to delete your share manually and view the visitor count.",

  "upload.modal.expires.never": "never",
  "upload.modal.expires.never-long": "Permanent share",
  "upload.modal.expires.error.too-long":
    "Expiration date exceeds the maximum of {max}.",

  "upload.modal.link.label": "Link",
  "upload.modal.expires.label": "Expiration",
  "upload.modal.expires.unit-label": "Unit",
  "upload.modal.expires.minute-singular": "Minute",
  "upload.modal.expires.minute-plural": "Minutes",
  "upload.modal.expires.hour-singular": "Hour",
  "upload.modal.expires.hour-plural": "Hours",
  "upload.modal.expires.day-singular": "Day",
  "upload.modal.expires.day-plural": "Days",
  "upload.modal.expires.week-singular": "Week",
  "upload.modal.expires.week-plural": "Weeks",
  "upload.modal.expires.month-singular": "Month",
  "upload.modal.expires.month-plural": "Months",
  "upload.modal.expires.year-singular": "Year",
  "upload.modal.expires.year-plural": "Years",

  "upload.modal.content.title": "Content",
  "upload.modal.content.description": "Files, text, and links are shared together.",
  "upload.modal.content.total":
    "{count, plural, =0 {No items} =1 {# item} other {# items}}",
  "upload.modal.content.files": "Files",
  "upload.modal.content.files.summary":
    "{count, plural, =0 {No files selected} =1 {# file selected} other {# files selected}} · {size}",
  "upload.modal.content.files.empty": "No files selected.",
  "upload.modal.content.files.more":
    "{count, plural, =1 {# more file} other {# more files}}",
  "upload.modal.content.text": "Text",
  "upload.modal.content.text.label": "Text item",
  "upload.modal.content.text.placeholder": "Paste a note or snippet",
  "upload.modal.content.text.add": "Add text",
  "upload.modal.content.text.empty": "No text items added.",
  "upload.modal.content.link": "Link",
  "upload.modal.content.link.label": "Link item",
  "upload.modal.content.link.add": "Add link",
  "upload.modal.content.link.empty": "No links added.",
  "upload.modal.content.link.invalid": "Enter a valid URL with protocol.",
  "upload.modal.inbox.submit": "Submit",
  "inbox.submission.created": "Submission received",
  "inbox.submit.title": "Submit to inbox",
  "inbox.submit.review": "Review submission",
  "inbox.submit.contentTitle": "Submission content",
  "inbox.submit.messageTitle": "Message (optional)",
  "inbox.submit.messagePlaceholder": "Add a note for the inbox owner",
  "inbox.submit.contentDescription":
    "Check the files, text, and links before submitting them.",
  "inbox.submit.receiptTitle": "Submission received",
  "inbox.submit.receipt":
    "Your content is waiting for review. Receipt ID: {id}",
  "inbox.submit.reviewNotice":
    "Your content will be reviewed before the inbox owner makes it available.",
  "upload.modal.details.title": "Details",
  "upload.modal.details.name.placeholder": "Name",
  "upload.modal.details.description.placeholder":
    "Note for the recipients of this share",
  "upload.modal.access.expiration.title": "Expiration",
  "upload.modal.access.email.title": "Email recipients",
  "upload.modal.access.email.placeholder": "Enter email recipients",
  "upload.modal.access.email.invalid-email": "Invalid email address",
  "upload.modal.access.security.title": "Security options",
  "upload.modal.access.security.password.label": "Password protection",
  "upload.modal.access.security.password.placeholder": "No password",
  "upload.modal.access.security.max-views.label": "Maximum views",
  "upload.modal.access.security.max-views.placeholder": "No limit",

  "upload.modal.accordion.name-and-description.title": "Name and description",
  "upload.modal.accordion.name-and-description.name.placeholder": "Name",
  "upload.modal.accordion.name-and-description.description.placeholder":
    "Note for the recipients of this share",

  "upload.modal.accordion.email.title": "Email recipients",
  "upload.modal.accordion.email.placeholder": "Enter email recipients",
  "upload.modal.accordion.email.invalid-email": "Invalid email address",

  "upload.modal.accordion.security.title": "Security options",
  "upload.modal.accordion.security.password.label": "Password protection",
  "upload.modal.accordion.security.password.placeholder": "No password",
  "upload.modal.accordion.security.max-views.label": "Maximum views",
  "upload.modal.accordion.security.max-views.placeholder": "No limit",

  // showCompletedUploadModal.tsx
  "upload.modal.completed.never-expires": "This share will never expire.",
  "upload.modal.completed.expires-on":
    "This share will expire on {expiration}.",
  "upload.modal.completed.share-ready": "Share ready",
  "upload.modal.completed.notified-reverse-share-creator":
    "We have notified the creator of the reverse share. You can also manually share this link with them through other means.",

  // END /upload

  // /share/[id]
  "share.title": "Share {shareId}",
  "share.description": "Look what I've shared with you!",
  "share.fileCount":
    "{count, plural, =1 {# file} other {# files}} · {size} (zip file may be smaller due to compression)",
  "share.assetCount":
    "{count, plural, =1 {# item} other {# items}} · {fileCount, plural, =1 {# file} other {# files}} · {size}",
  "share.asset.add.title": "Add item",
  "share.asset.add": "Add item",
  "share.asset.copy-text": "Copy text",
  "share.asset.notify.created": "Share item added",
  "share.asset.notify.deleted": "Share item deleted",
  "share.asset.manage.title": "Items",
  "share.asset.manage.empty": "No items yet.",
  "share.asset.modal.delete.title": "Delete share item",
  "share.asset.modal.delete.description":
    "This text or link item will be permanently removed from the share.",
  "share.copy-text-contents": "Copy file contents to clipboard",
  "share.error.visitor-limit-exceeded.title": "Visitor limit exceeded",
  "share.error.visitor-limit-exceeded.description":
    "The visitor limit from this share has been exceeded.",
  "share.error.removed.title": "Share removed",
  "share.error.not-found.title": "Share not found",
  "share.error.not-found.description":
    "The share you're looking for doesn't exist.",
  "share.error.access-denied.title": "Private share",
  "share.error.access-denied.description":
    "The current account does not have permission to access this share",

  "share.modal.password.title": "Password required",
  "share.modal.password.description":
    "Please enter the password to access this share.",
  "share.modal.password": "Password",
  "share.modal.error.invalid-password": "Invalid password",

  "share.button.download-all": "Download all",
  "share.notify.download-all-preparing":
    "The share is being prepared. Please try again in a few minutes.",

  "share.notify.copied-contents": "File contents copied to clipboard",
  "share.notify.copy-too-big-error": "File is too big to copy to clipboard",
  "share.notify.copy-not-supported-error":
    "Copying to clipboard requires a HTTPS connection",

  "share.modal.file-link": "File link",
  "share.table.type": "Type",
  "share.table.name": "Name",
  "share.table.size": "Size",

  "share.modal.file-preview.error.not-supported.title": "Preview not supported",
  "share.modal.file-preview.error.not-supported.description":
    "Previews are not supported for this type of files. Please download the file to view it.",

  // END /share/[id]

  // /share/[id]/edit
  "share.edit.title": "Edit {shareId}",
  "share.edit.append-upload": "Append file",
  "share.edit.notify.generic-error":
    "An error occurred while finishing your share.",
  "share.edit.notify.save-success": "Share updated successfully",
  // END /share/[id]/edit

  // /imprint
  "imprint.title": "Imprint",
  // END /imprint

  // /privacy
  "privacy.title": "Privacy Policy",
  // END /privacy

  // /admin/config
  "admin.config.config-file-warning.title": "Configuration file present",
  "admin.config.config-file-warning.description":
    "As you have a configured Share with a configuration file, you can't change the configuration through the UI.",
  "admin.config.title": "Configuration",
  "admin.config.category.general": "General",
  "admin.config.category.appearance": "Appearance",
  "admin.config.category.share": "Share",
  "admin.config.category.cache": "Cache",
  "admin.config.category.email": "Email",
  "admin.config.category.smtp": "SMTP",
  "admin.config.category.oauth": "Social Login",
  "admin.config.general.app-name": "App name",
  "admin.config.general.app-name.description": "Name of the application",
  "admin.config.general.default-language": "Default Language",
  "admin.config.general.default-language.description":
    "This applies to all users, each user can still personalise their language in their profile.",
  "admin.config.appearance.theme-primary-color": "Theme primary color",
  "admin.config.appearance.theme-primary-color.description":
    "Primary color used for buttons, links, and accents. Choose custom to use a color picker override.",
  "admin.config.appearance.theme-primary-color-override":
    "Custom primary color",
  "admin.config.appearance.theme-primary-color-override.description":
    "Hex color override used when theme primary color is set to custom.",
  "admin.config.appearance.theme-font-preset": "Theme font preset",
  "admin.config.appearance.theme-font-preset.description":
    "Font preset loaded at build time. Choose system default or one of the bundled Google Fonts.",
  "admin.config.appearance.theme-color-scheme": "Default color scheme (guests)",
  "admin.config.appearance.theme-color-scheme.description":
    "Default light/dark mode for non-logged-in users. Logged-in users use their own account preference.",
  "admin.config.appearance.theme-radius": "Theme border radius",
  "admin.config.appearance.theme-radius.description":
    "Default border radius used by Mantine components.",
  "admin.config.appearance.custom-css": "Custom CSS",
  "admin.config.appearance.custom-css.description":
    "Global CSS applied to the frontend. Use carefully, as invalid CSS may affect the UI.",
  "admin.config.general.app-url": "App URL",
  "admin.config.general.app-url.description":
    "On which URL Share is available",
  "admin.config.general.secure-cookies": "Secure cookies",
  "admin.config.general.secure-cookies.description":
    "Whether to set the secure flag on cookies. If enabled, the site will not function when accessed over HTTP.",
  "admin.config.general.show-home-page": "Show home page",
  "admin.config.general.show-home-page.description":
    "Whether to show the home page",
  "admin.config.general.session-duration": "Session Duration",
  "admin.config.general.session-duration.description":
    "Time after which a user must log in again (default: 3 months).",
  "admin.config.general.logo": "Logo",
  "admin.config.general.logo.description":
    "Change your logo by uploading a new image. The image must be a PNG and should have the format 1:1.",
  "admin.config.general.logo-dark": "Dark mode logo",
  "admin.config.general.logo-dark.description":
    "Upload a separate logo for dark mode. The image must be a PNG and should have the format 1:1.",
  "admin.config.general.logo.placeholder": "Pick image",
  "admin.config.cache.ttl": "TTL",
  "admin.config.cache.ttl.description":
    "Time in second to keep information inside the cache.",
  "admin.config.cache.max-items": "Maximum items",
  "admin.config.cache.max-items.description":
    "Maximum number of items inside the cache.",
  "admin.config.cache.redis-enabled": "Redis enabled",
  "admin.config.cache.redis-enabled.description":
    "Normally Share caches information in memory. If you run multiple instances of Share, you need to enable Redis caching to share the cache between the instances.",
  "admin.config.cache.redis-url": "Redis URL",
  "admin.config.cache.redis-url.description":
    "Url to connect to the Redis instance used for caching.",
  "admin.config.cache.button.test-redis": "Test Redis connection",
  "admin.config.cache.test-redis.success": "Connected to Redis successfully",
  "admin.config.cache.test-redis.success-disabled":
    "Connected to Redis successfully (Redis caching is currently disabled).",
  "admin.config.cache.test-redis.modal.error.title":
    "Failed to connect to Redis",
  "admin.config.cache.test-redis.modal.error.description":
    "While connecting to Redis, the following error occurred:",
  "admin.config.cache.test-redis.modal.save.title": "Save configuration",
  "admin.config.cache.test-redis.modal.save.description":
    "To continue you need to save the configuration first. Do you want to save the configuration and test the Redis connection?",
  "admin.config.cache.test-redis.modal.save.confirm": "Save and test",
  "admin.config.email.enable-share-email-recipients":
    "Enable email recipient sharing",
  "admin.config.email.enable-share-email-recipients.description":
    "Whether to allow email sharing with recipients. This can only be enabled if SMTP is activated.",
  "admin.config.email.share-recipients-subject": "Share recipients subject",
  "admin.config.email.share-recipients-subject.description":
    "Subject of the email which gets sent to the share recipients.",
  "admin.config.email.share-recipients-message": "Share recipients message",
  "admin.config.email.share-recipients-message.description":
    "Message which gets sent to the share recipients. Available variables:\n {creator} - The username of the creator of the share\n {creatorEmail} - The email of the creator of the share\n {shareUrl} - The URL of the share\n {desc} - The description of the share\n {expires} - The expiration date of the share\n These variables will be replaced with the actual value.",
  "admin.config.email.reverse-share-subject": "Reverse share subject",
  "admin.config.email.reverse-share-subject.description":
    "Subject of the sent email when someone created a share with your reverse share link.",
  "admin.config.email.reverse-share-message": "Reverse share message",
  "admin.config.email.reverse-share-message.description":
    "Message which gets sent when someone created a share with your reverse share link. {shareUrl} will be replaced with the creator's name and the share URL.",
  "admin.config.email.reset-password-subject": "Reset password subject",
  "admin.config.email.reset-password-subject.description":
    "Subject of the sent email when a user requests a password reset.",
  "admin.config.email.reset-password-message": "Reset password message",
  "admin.config.email.reset-password-message.description":
    "Message which gets sent when a user requests a password reset. {url} will be replaced with the reset password URL.",
  "admin.config.email.invite-subject": "Invite subject",
  "admin.config.email.invite-subject.description":
    "Subject of the sent email when an admin invites a user.",
  "admin.config.email.invite-message": "Invite message",
  "admin.config.email.invite-message.description":
    "Message which gets sent when an admin invites a user. {url} will be replaced with the invite URL, {email} with the email and {password} with the users password.",
  "admin.config.email.enable-share-download-notifications":
    "Enable download notifications",
  "admin.config.email.enable-share-download-notifications.description":
    "Whether to send an email to the share creator when an email recipient downloads a file. This requires SMTP and email recipient sharing.",
  "admin.config.email.share-download-notification-subject":
    "Download notification subject",
  "admin.config.email.share-download-notification-subject.description":
    "Subject of the email which gets sent to the share creator when a recipient downloads a file.",
  "admin.config.email.share-download-notification-message":
    "Download notification message",
  "admin.config.email.share-download-notification-message.description":
    "Message which gets sent to the share creator when a recipient downloads a file. Available variables:\n {recipientEmail} - The email of the recipient\n {fileName} - The downloaded file name\n {shareUrl} - The URL of the share",
  "admin.config.share.allow-registration": "Allow registration",
  "admin.config.share.allow-registration.description":
    "Whether registration is allowed",
  "admin.config.share.allow-unauthenticated-shares":
    "Allow unauthenticated shares",
  "admin.config.share.allow-unauthenticated-shares.description":
    "Whether unauthenticated users can create shares",
  "admin.config.share.default-expiration": "Default expiration",
  "admin.config.share.default-expiration.description":
    "The default expiration time selected when creating a new share.",
  "admin.config.share.max-expiration": "Max expiration",
  "admin.config.share.max-expiration.description":
    "Maximum share expiration. Set to 0 to allow unlimited expiration.",
  "admin.config.share.share-id-length": "Default share ID length",
  "admin.config.share.share-id-length.description":
    "Default length for the generated ID of a share. This value is also used to generate links for reverse shares. A value below 8 is not considered secure.",
  "admin.config.share.max-size": "Max size",
  "admin.config.share.max-size.description": "Maximum share size",
  "admin.config.share.zip-compression-level": "Zip compression level",
  "admin.config.share.zip-compression-level.description":
    "Adjust the level to balance between file size and compression speed. Valid values range from 0 to 9, with 0 being no compression and 9 being maximum compression. ",
  "admin.config.share.chunk-size": "Chunk size",
  "admin.config.share.chunk-size.description":
    "Adjust the chunk size for your uploads to balance efficiency and reliability according to your internet connection. Smaller chunks can enhance success rates for unstable connections, while larger chunks make uploads faster for stable connections.",
  "admin.config.share.auto-open-share-modal": "Auto open create share modal",
  "admin.config.share.auto-open-share-modal.description":
    "The share creation modal automatically appears when a user selects files, eliminating the need to manually click the button.",
  "admin.config.share.allow-admin-access-all-shares":
    "Allow admin access to all shares",
  "admin.config.share.allow-admin-access-all-shares.description":
    "Allow administrators to access all shares, even if they are password protected, expired or deleted.",
  "admin.config.share.file-retention-period": "File retention period",
  "admin.config.share.file-retention-period.description":
    "How long files are kept after a share expires or gets deleted. Only useful if the 'Allow admin access to all shares' is also enabled. Set to -1 to keep files forever.",
  "admin.config.smtp.enabled": "Enable",
  "admin.config.smtp.enabled.description":
    "Whether SMTP is enabled. Only set this to true if you entered the host, port, email, user and password of your SMTP server.",
  "admin.config.smtp.host": "Host",
  "admin.config.smtp.host.description": "Host of the SMTP server",
  "admin.config.smtp.port": "Port",
  "admin.config.smtp.port.description": "Port of the SMTP server",
  "admin.config.smtp.email": "Email",
  "admin.config.smtp.email.description":
    "Email address from which the emails get sent",
  "admin.config.smtp.username": "Username",
  "admin.config.smtp.username.description": "Username of the SMTP server",
  "admin.config.smtp.password": "Password",
  "admin.config.smtp.password.description": "Password of the SMTP server",
  "admin.config.smtp.button.test": "Send test email",
  "admin.config.smtp.test-email.success": "Email sent successfully",
  "admin.config.smtp.test-email.error.title": "Failed to send email",
  "admin.config.smtp.test-email.error.description":
    "While sending the test email, the following error occurred:",
  "admin.config.smtp.test-email.save.title": "Save configuration",
  "admin.config.smtp.test-email.save.description":
    "To continue you need to save the configuration first. Do you want to save the configuration and send the test email?",
  "admin.config.smtp.test-email.save.confirm": "Save and send",
  "admin.config.smtp.allow-unauthorized-certificates":
    "Trust unauthorized SMTP server certificates",
  "admin.config.smtp.allow-unauthorized-certificates.description":
    "Only set this to true if you need to trust self signed certificates.",
  "admin.config.oauth.allow-registration": "Allow registration",
  "admin.config.oauth.allow-registration.description":
    "Allow users to register via social login",
  "admin.config.oauth.ignore-totp": "Ignore TOTP",
  "admin.config.oauth.ignore-totp.description":
    "Whether to ignore TOTP when user using social login",
  "admin.config.oauth.disable-password": "Disable password login",
  "admin.config.oauth.disable-password.description":
    "Whether to disable password login\nMake sure that an OAuth provider is properly configured before activating this configuration to avoid being locked out.",
  "admin.config.oauth.github-enabled": "GitHub",
  "admin.config.oauth.github-enabled.description":
    "Whether GitHub login is enabled",
  "admin.config.oauth.github-client-id": "GitHub Client ID",
  "admin.config.oauth.github-client-id.description":
    "Client ID of the GitHub OAuth app",
  "admin.config.oauth.github-client-secret": "GitHub Client secret",
  "admin.config.oauth.github-client-secret.description":
    "Client secret of the GitHub OAuth app",
  "admin.config.oauth.google-enabled": "Google",
  "admin.config.oauth.google-enabled.description":
    "Whether Google login is enabled",
  "admin.config.oauth.google-client-id": "Google Client ID",
  "admin.config.oauth.google-client-id.description":
    "Client ID of the Google OAuth app",
  "admin.config.oauth.google-client-secret": "Google Client secret",
  "admin.config.oauth.google-client-secret.description":
    "Client secret of the Google OAuth app",
  "admin.config.oauth.microsoft-enabled": "Microsoft",
  "admin.config.oauth.microsoft-enabled.description":
    "Whether Microsoft login is enabled",
  "admin.config.oauth.microsoft-tenant": "Microsoft Tenant",
  "admin.config.oauth.microsoft-tenant.description":
    "Tenant ID of the Microsoft OAuth app\ncommon: Users with both a personal Microsoft account and a work or school account from Microsoft Entra ID can sign in to the application. organizations: Only users with work or school accounts from Microsoft Entra ID can sign in to the application.\nconsumers: Only users with a personal Microsoft account can sign in to the application.\ndomain name of the Microsoft Entra tenant or the tenant ID in GUID format: Only users from a specific Microsoft Entra tenant (directory members with a work or school account or directory guests with a personal Microsoft account) can sign in to the application.",
  "admin.config.oauth.microsoft-client-id": "Microsoft Client ID",
  "admin.config.oauth.microsoft-client-id.description":
    "Client ID of the Microsoft OAuth app",
  "admin.config.oauth.microsoft-client-secret": "Microsoft Client secret",
  "admin.config.oauth.microsoft-client-secret.description":
    "Client secret of the Microsoft OAuth app",
  "admin.config.oauth.discord-enabled": "Discord",
  "admin.config.oauth.discord-enabled.description":
    "Whether Discord login is enabled",
  "admin.config.oauth.discord-limited-users": "Discord limited users",
  "admin.config.oauth.discord-limited-users.description":
    "Limit signing in to specific users by their Discord ID. Leave it blank to disable.",
  "admin.config.oauth.discord-limited-guild": "Discord limited server ID",
  "admin.config.oauth.discord-limited-guild.description":
    "Limit signing in to users in a specific server. Leave it blank to disable.",
  "admin.config.oauth.discord-client-id": "Discord Client ID",
  "admin.config.oauth.discord-client-id.description":
    "Client ID of the Discord OAuth app",
  "admin.config.oauth.discord-client-secret": "Discord Client secret",
  "admin.config.oauth.discord-client-secret.description":
    "Client secret of the Discord OAuth app",
  "admin.config.oauth.oidc-enabled": "OpenID Connect",
  "admin.config.oauth.oidc-enabled.description":
    "Whether OpenID Connect login is enabled",
  "admin.config.oauth.oidc-discovery-uri": "OpenID Connect Discovery URI",
  "admin.config.oauth.oidc-discovery-uri.description":
    "Discovery URI of the OpenID Connect OAuth app",
  "admin.config.oauth.oidc-sign-out": "Sign out from OpenID Connect",
  "admin.config.oauth.oidc-sign-out.description":
    "Whether the “Sign out” button will sign out from the OpenID Connect provider",
  "admin.config.oauth.oidc-scope": "OpenID Connect scope",
  "admin.config.oauth.oidc-scope.description":
    "Scopes which should be requested from the OpenID Connect provider.",
  "admin.config.oauth.oidc-username-claim": "OpenID Connect username claim",
  "admin.config.oauth.oidc-username-claim.description":
    "Username claim in OpenID Connect ID token. Leave it blank if you don't know what this config is.",
  "admin.config.oauth.oidc-role-path": "Path to roles in OpenID Connect token",
  "admin.config.oauth.oidc-role-path.description":
    "Must be a valid JMES path referencing an array of roles. " +
    "Managing access rights using OpenID Connect roles is only recommended if no other identity provider is configured and password login is disabled. " +
    "Leave it blank if you don't know what this config is.",
  "admin.config.oauth.oidc-role-general-access":
    "OpenID Connect role for general access",
  "admin.config.oauth.oidc-role-general-access.description":
    "Role required for general access. Must be present in a user’s roles for them to log in. " +
    "Leave it blank if you don't know what this config is.",
  "admin.config.oauth.oidc-role-admin-access":
    "OpenID Connect role for admin access",
  "admin.config.oauth.oidc-role-admin-access.description":
    "Role required for administrative access. Must be present in a user’s roles for them to access the admin panel. " +
    "Leave it blank if you don't know what this config is.",
  "admin.config.oauth.oidc-client-id": "OpenID Connect Client ID",
  "admin.config.oauth.oidc-client-id.description":
    "Client ID of the OpenID Connect OAuth app",
  "admin.config.oauth.oidc-client-secret": "OpenID Connect Client secret",
  "admin.config.oauth.oidc-client-secret.description":
    "Client secret of the OpenID Connect OAuth app",
  "admin.config.category.ldap": "LDAP",
  "admin.config.ldap.enabled": "Enable LDAP",
  "admin.config.ldap.enabled.description":
    "Use LDAP authentication for user login",
  "admin.config.ldap.url": "Server URL",
  "admin.config.ldap.url.description": "URL of the LDAP server",
  "admin.config.ldap.bind-dn": "Bind DN",
  "admin.config.ldap.bind-dn.description":
    "Default user used to perform the user search",
  "admin.config.ldap.bind-password": "Bind password",
  "admin.config.ldap.bind-password.description":
    "Password used to perform the user search",
  "admin.config.ldap.search-base": "User base",
  "admin.config.ldap.search-base.description":
    "Base location, where the user search will be performed",
  "admin.config.ldap.search-query": "User query",
  "admin.config.ldap.search-query.description":
    "The user query will be used to search the 'User base' for the LDAP user. %username% can be used as the placeholder for the user given input.",
  "admin.config.ldap.admin-groups": "Admin group",
  "admin.config.ldap.admin-groups.description":
    "Group required for administrative access.",
  "admin.config.ldap.field-name-member-of": "User groups attribute name",
  "admin.config.ldap.field-name-member-of.description":
    "LDAP attribute name for the groups, an user is a member of. This is used when checking for the admin group.",
  "admin.config.ldap.field-name-email": "User email attribute name",
  "admin.config.ldap.field-name-email.description":
    "LDAP attribute name for the email of an user.",
  "admin.config.notify.success": "Configuration updated successfully.",
  "admin.config.notify.logo-success":
    "Logo updated successfully. It may take a few minutes to update on the website.",
  "admin.config.notify.no-changes": "No changes to save.",
  "admin.config.category.s3": "S3",
  "admin.config.s3.enabled": "Enabled",
  "admin.config.s3.enabled.description":
    "Whether S3 should be used to store the shared files instead of the local file system. WARNING: If ClamAV is active, files will be temporarily downloaded from S3 to be checked.",
  "admin.config.s3.endpoint": "Endpoint",
  "admin.config.s3.endpoint.description": "The URL of the S3 bucket.",
  "admin.config.s3.region": "Region",
  "admin.config.s3.region.description": "The region of the S3 bucket.",
  "admin.config.s3.bucket-name": "Bucket name",
  "admin.config.s3.bucket-name.description": "The name of the S3 bucket.",
  "admin.config.s3.bucket-path": "Path",
  "admin.config.s3.bucket-path.description":
    "The default path which should be used to store the files in the S3 bucket.",
  "admin.config.s3.key": "Key",
  "admin.config.s3.key.description":
    "The key which allows you to access the S3 bucket.",
  "admin.config.s3.secret": "Secret",
  "admin.config.s3.secret.description":
    "The secret which allows you to access the S3 bucket.",
  "admin.config.s3.use-checksum": "Use checksum",
  "admin.config.s3.use-checksum.description":
    "Turn off for backends that do not support checksum (e.g. B2).",
  "admin.config.s3.force-path-style": "Force path style",
  "admin.config.s3.force-path-style.description":
    "Use path-style addressing (e.g. endpoint/bucket) instead of virtual-hosted style (e.g. bucket.endpoint). Turn off for providers that require virtual-hosted style, such as Tencent COS.",
  "admin.config.s3.file-rename-rules": "File rename rules",
  "admin.config.s3.file-rename-rules.description":
    "Automatically rename matching files on upload. Each rule has a pattern and a replacement. For 'glob' rules, '*' is a wildcard whose captured parts fill the '*' placeholders in the replacement (e.g. '*.apk' -> '*.apk.1'). For 'regex' rules, the pattern is a regular expression and the replacement uses $1, $2 backreferences. The first matching rule wins.",
  "admin.config.s3.file-rename-rules.pattern": "Pattern",
  "admin.config.s3.file-rename-rules.replacement": "Replacement",
  "admin.config.s3.file-rename-rules.type": "Type",
  "admin.config.s3.file-rename-rules.glob": "Wildcard",
  "admin.config.s3.file-rename-rules.regex": "Regex",
  "admin.config.s3.file-rename-rules.add": "Add rule",
  "admin.config.category.legal": "Legal",
  "admin.config.legal.enabled": "Enable legal notices",
  "admin.config.legal.enabled.description":
    "Whether to show a link to imprint and privacy policy in the footer.",
  "admin.config.legal.imprint-text": "Imprint text",
  "admin.config.legal.imprint-text.description":
    "The text which should be shown in the imprint. Supports Markdown. Leave blank to link to an external imprint page.",
  "admin.config.legal.imprint-url": "Imprint URL",
  "admin.config.legal.imprint-url.description":
    "If you already have an imprint page you can link it here instead of using the text field.",
  "admin.config.legal.privacy-policy-text": "Privacy policy text",
  "admin.config.legal.privacy-policy-text.description":
    "The text which should be shown in the privacy policy. Supports Markdown. Leave blank to link to an external privacy policy page.",
  "admin.config.legal.privacy-policy-url": "Privacy policy URL",
  "admin.config.legal.privacy-policy-url.description":
    "If you already have a privacy policy page you can link it here instead of using the text field.",

  // 404
  "404.description": "Oops this page doesn't exist.",
  "404.button.home": "Bring me back home",

  // error
  "error.title": "Error",
  "error.description": "Oops!",
  "error.button.back": "Go back",
  "error.msg.default": "Something went wrong.",
  "error.msg.access_denied":
    "You canceled the authentication process, please try again.",
  "error.msg.expired_token":
    "The authentication process took too long, please try again.",
  "error.msg.invalid_token": "Internal Error",
  "error.msg.no_user": "User linked to this {0} account doesn't exist.",
  "error.msg.no_email": "Can't get email address from this {0} account.",
  "error.msg.already_linked":
    "This {0} account is already linked to another account.",
  "error.msg.not_linked":
    "This {0} account hasn't been linked to any account yet.",
  "error.msg.unverified_account":
    "This {0} account is unverified, please try again after verification.",
  "error.msg.user_not_allowed": "You are not allowed to sign in.",
  "error.msg.cannot_get_user_info":
    "Cannot get your user info from this {0} account.",
  "error.param.provider_github": "GitHub",
  "error.param.provider_google": "Google",
  "error.param.provider_microsoft": "Microsoft",
  "error.param.provider_discord": "Discord",
  "error.param.provider_oidc": "OpenID Connect",

  // Common translations
  "common.button.info": "Info",
  "common.button.undo": "Undo",
  "common.button.download": "Download",
  "common.button.copy": "Copy",
  "common.button.copy-link": "Copy link",
  "common.button.preview": "Preview",
  "common.button.edit": "Edit",
  "common.button.profile": "Profile",
  "common.button.shares": "Shares",
  "common.button.save": "Save",
  "common.button.create": "Create",
  "common.button.submit": "Submit",
  "common.button.delete": "Delete",
  "common.button.cancel": "Cancel",
  "common.button.confirm": "Confirm",
  "common.button.disable": "Disable",
  "common.button.share": "Share",
  "common.button.generate": "Generate",
  "common.button.done": "Done",
  "common.text.link": "Link",
  "common.text.navigate-to-link": "Visit link",
  "common.text.loading": "Loading...",
  "common.text.or": "or",
  "common.text.redirecting": "Redirecting...",
  "common.button.go-back": "Go back",
  "common.button.go-home": "Go home",
  "common.notify.copied": "Your link was copied to the clipboard",
  "common.notify.copied-link": "Your link was copied to the clipboard",
  "common.success": "Success",

  "common.error": "Error",
  "common.error.unknown": "An unknown error occurred",
  "common.error.invalid-email": "Invalid email address",
  "common.error.too-short": "Must be at least {length} characters",
  "common.error.too-long": "Must be at most {length} characters",
  "common.error.number-too-small": "Must be at least {min}",
  "common.error.number-too-large": "Must be at most {max}",
  "common.error.exact-length": "Must be exactly {length} characters",
  "common.error.invalid-number": "Must be a number",
  "common.error.field-required": "This field is required",

  // Access control
  "accessControl.title": "Access control",
  "accessControl.password": "Password",
  "accessControl.password.placeholder": "Leave empty for no password",
  "accessControl.expiresAt": "Expires at",
  "accessControl.maxViews": "Maximum views",
  "accessControl.maxViews.placeholder": "Unlimited",
  "accessControl.allowDownload": "Allow downloads",
  "accessControl.allowDownload.description":
    "Visitors can download the files, not just preview them.",
  "accessControl.allowAnonymous": "Allow anonymous access",
  "accessControl.allowAnonymous.description":
    "Anyone with the link can open it without signing in.",
  "accessControl.oneTime": "One-time access",
  "accessControl.oneTime.description":
    "The link stops working after it is opened once.",
};
