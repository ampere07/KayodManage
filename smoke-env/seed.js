// Demo data for the manual smoke test: made-up users, jobs, quotes and
// verification submissions, the same on every run (only dates move with today).
// Writes ONLY to the throwaway replica set start.js runs on 127.0.0.1:27037 —
// never the live database. Every document goes through the app's own Mongoose
// model (validateSync), so it is shaped like a real write; collections the
// admin app has no model for (jobquotes, reviews) use the shapes it reads.
//
// usage: node smoke-env/seed.js <dbName>   (db name must start with smoke_;
//        start.js runs this for you)
const path = require('path');
const fs = require('fs');
const B = path.resolve(__dirname, '..', 'Backend');
const mongoose = require(path.join(B, 'node_modules/mongoose'));
const bcrypt = require(path.join(B, 'node_modules/bcryptjs'));
const M = (n) => require(path.join(B, 'app/models', n));
const User = M('User'), Wallet = M('Wallet'), Job = M('Job'),
  Transaction = M('Transaction'), CredentialVerification = M('CredentialVerification'),
  ActivityLog = M('ActivityLog'), JobCategory = M('JobCategory');

const DB = process.argv[2];
if (!/^smoke_/.test(DB || '')) throw new Error('refusing: db name must start with smoke_');
const URI = `mongodb://127.0.0.1:27037/${DB}?replicaSet=rssmoke`;

let seed = 20261017;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const NOW = Date.now();
const ago = (days, hours = 0) => new Date(NOW - days * 864e5 - hours * 36e5);
const ahead = (days) => new Date(NOW + days * 864e5);
let oidN = 0;
const oid = (date = new Date(NOW)) => {
  const ts = Math.floor(date.getTime() / 1000).toString(16).padStart(8, '0');
  return new mongoose.Types.ObjectId(ts + 'b2c3d4e5' + (++oidN).toString(16).padStart(8, '0'));
};
// Pictures are served by the demo frontend (start.js, /demo-images): labelled
// stand-ins, so nothing is fetched from ImageKit or Cloudinary.
const IMG = (tag) => `http://localhost:5180/demo-images/${tag}.svg`;

const out = {};
async function put(Model, docs) {
  const rows = docs.map((d) => {
    const m = new Model(d);
    const err = m.validateSync();
    if (err) throw new Error(`${Model.modelName}: ${err.message}\n${JSON.stringify(d).slice(0, 400)}`);
    return m.toObject({ virtuals: false, getters: false, depopulate: true });
  });
  (out[Model.collection.name] ||= []).push(...rows);
  return rows;
}
const putRaw = (coll, docs) => (out[coll] ||= []).push(...docs);

const FIRST = ['Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Liza', 'Carlo', 'Rosa', 'Miguel', 'Grace', 'Ramon', 'Joy', 'Paolo', 'Bea', 'Nico', 'Tess', 'Marco', 'Ivy', 'Rafael', 'Kim', 'Diego', 'Lea', 'Andres', 'Mae', 'Tonio', 'Cora', 'Felix', 'Nina', 'Oscar', 'Pia'];
const LAST = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Flores', 'Villanueva', 'Ramos', 'Aquino', 'Castillo', 'Navarro', 'Dela Cruz'];
const CITIES = ['Quezon City', 'Makati', 'Pasig', 'Taguig', 'Cebu City', 'Davao City', 'Manila', 'Mandaluyong'];
// Real Kayod categories and professions (kayod/server seedInitialCategories),
// stored the way the admin stores them, so the portal shows real icons:
//  - a category icon is one of the admin's bundled keys (constants/categoryIcons.ts),
//    served from the frontend itself;
//  - a profession icon is `ik:/professionIconsUpload/<file>.webp` on the Kayod image
//    host. Only files that exist there are used (checked 2026-10-17); a profession
//    without one is left blank, and the portal shows its category icon instead —
//    a broken image link would fall back to a generic picture.
const IK = (file) => `ik:/professionIconsUpload/${file}.webp`;
const CATS = [
  { name: 'Construction & Trades', icon: 'construction-trades', professions: [['Plumbing', IK('plumbing')], ['Electrical', IK('electrical')], ['Carpentry', IK('carpentry-cabinetry')]] },
  { name: 'Home & Property', icon: 'home-property', professions: [['Cleaning', IK('house-cleaning')], ['General Handyman', IK('general-handyman')], ['Laundry', '']] },
  { name: 'Health & Wellness', icon: 'health-wellness', professions: [['Hair & Nails', IK('hair-nails')], ['Massage', ''], ['Nail Care', IK('hair-nails')]] },
  { name: 'Electronics & Technology', icon: 'electronics-technology', professions: [['Computer Technician', IK('computer-technician')], ['Cellphone Repair', ''], ['CCTV Installation', '']] },
];

async function main() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  if ((await db.listCollections().toArray()).length) throw new Error(`${DB} is not empty — drop it first`);
  const ids = {};

  const cats = await put(JobCategory, CATS.map((c, i) => ({
    _id: oid(ago(300)), name: c.name, icon: c.icon,
    professions: c.professions.map(([name, icon], j) => ({ name, icon, isQuickAccess: j === 0, quickAccessOrder: i })),
    createdAt: ago(300), updatedAt: ago(30),
  })));
  const professions = cats.flatMap((c) => c.professions.map((p) => ({ cat: c, prof: p })));

  const pw = await bcrypt.hash('smoke-test-only', 10);
  const admins = await put(User, [
    { name: 'Smoke Admin', email: 'smoke.admin', userType: 'superadmin' },
    { name: 'Olivia Ops', email: 'olivia.ops@kayod.test', userType: 'admin' },
  ].map((a, i) => ({ _id: oid(ago(400 - i)), ...a, password: pw, phone: `+63917000000${i}`, location: 'Admin Office',
    accountStatus: 'active', isVerified: true, permissions: { settings: a.userType === 'superadmin' },
    lastLogin: ago(i), createdAt: ago(400 - i), updatedAt: ago(i) })));
  const admin = admins[0];
  ids.adminId = String(admin._id);

  // 32 clients + 28 providers = 60 marketplace users (3 pages at 20/page)
  const statusPlan = (n, plan) => Array.from({ length: n }, (_, i) => plan[i] || 'active');
  const clientStates = statusPlan(32, { 3: 'restricted', 11: 'suspended', 19: 'banned', 23: 'deleted' });
  const providerStates = statusPlan(28, { 2: 'restricted', 6: 'suspended', 14: 'banned', 18: 'deleted' });
  const restriction = (state, i) => state === 'active' ? undefined : {
    type: state, reason: `${state} after review of reports (case ${100 + i})`, restrictedBy: admin._id,
    restrictedAt: ago(int(1, 20)), appealAllowed: state !== 'banned',
    ...(state === 'suspended' ? { suspendedUntil: ahead(int(3, 30)), expiresAt: ahead(int(3, 30)) } : {}),
    ...(state === 'restricted' ? { expiresAt: ahead(int(2, 14)) } : {}),
  };
  const mkUser = (userType, state, i) => {
    // createdAt strictly decreasing with i so list order is predictable (newest first)
    const created = ago(5 + i * 6 + (userType === 'provider' ? 3 : 0));
    const name = `${FIRST[(i * 7 + (userType === 'provider' ? 3 : 0)) % FIRST.length]} ${LAST[(i * 5 + (userType === 'provider' ? 2 : 0)) % LAST.length]}`;
    const pp = userType === 'provider' ? professions[i % professions.length] : null;
    const verified = state === 'active' ? i % 5 !== 1 && i % 5 !== 3 : false;
    return {
      _id: oid(created), name, email: `${name.toLowerCase().replace(/ /g, '.')}.${userType[0]}${i}@smoke.test`,
      phone: `+63918${String(1000000 + i * 37 + (userType === 'provider' ? 500 : 0)).slice(-7)}`,
      userType, location: pick(CITIES), accountStatus: state, isRestricted: state !== 'active',
      restrictionDetails: restriction(state, i), isVerified: verified,
      credentialVerificationStatus: verified ? 'approved' : 'none',
      categories: pp ? [pp.prof.name] : [], category: pp ? pp.cat.name : undefined,
      ratings: userType === 'provider' ? Math.round((3 + rnd() * 2) * 10) / 10 : 0,
      isOnline: false, lastLogin: ago(int(0, 30)),
      createdAt: created, updatedAt: ago(int(0, 4)),
    };
  };
  const clientDocs = clientStates.map((s, i) => mkUser('client', s, i));
  // Fixed, recognisable fixtures
  clientDocs[31].name = 'Quintessa Marlowe'; clientDocs[31].email = 'quintessa.marlowe@smoke.test'; // oldest client → last page
  clientDocs[0].name = 'Lena Legal'; clientDocs[0].email = 'lena.legal@smoke.test'; clientDocs[0].isVerified = true; clientDocs[0].credentialVerificationStatus = 'approved';
  clientDocs[0].legalAcceptances = [
    { version: '2026.09', documentIds: ['terms-of-service', 'privacy-policy'], context: 'sign-up', acceptedAt: ago(40), ipAddress: '10.0.0.5', userAgent: 'KayodApp/3.2' },
    { version: '2026.10', documentIds: ['booking-terms'], context: 'booking', acceptedAt: ago(3), ipAddress: '10.0.0.5', userAgent: 'KayodApp/3.3' },
  ];
  clientDocs[1].name = 'Uma Unverified'; clientDocs[1].email = 'uma.unverified@smoke.test'; clientDocs[1].isVerified = false; clientDocs[1].credentialVerificationStatus = 'none';
  clientDocs[1].legalAcceptances = [];
  const clients = await put(User, clientDocs);
  const providers = await put(User, providerStates.map((s, i) => mkUser('provider', s, i)));
  const activeClients = clients.filter((u) => u.accountStatus === 'active');
  const activeProviders = providers.filter((u) => u.accountStatus === 'active');
  Object.assign(ids, {
    uSearchLastPage: String(clients[31]._id), uLegal: String(clients[0]._id), uUnverified: String(clients[1]._id),
    uRestrict: String(clients[4]._id), uSuspend: String(clients[5]._id), uBan: String(clients[6]._id), uDelete: String(clients[7]._id),
    uAlreadyRestricted: String(clients[3]._id),
  });

  await put(Wallet, [...clients, ...providers].map((u) => {
    const avail = int(0, 40) * 250;
    return { userId: u._id, balance: avail, availableBalance: avail, heldBalance: 0, createdAt: u.createdAt, updatedAt: ago(int(0, 10)) };
  }));

  // Jobs across every status
  const jobPlan = [
    ...Array(11).fill('open'), ...Array(7).fill('in_progress'), ...Array(3).fill('scheduled'),
    ...Array(16).fill('completed'), ...Array(5).fill('cancelled'), ...Array(2).fill('expired'),
  ];
  const TITLES = { Plumbing: 'Fix leaking kitchen sink', Electrical: 'Install ceiling fan', Carpentry: 'Repair cabinet doors', Cleaning: 'Deep clean 2BR condo', 'General Handyman': 'Clean 2 split-type aircons', Laundry: 'Weekly laundry pickup', 'Hair & Nails': 'Home haircut for 3', Massage: 'Full body massage', 'Nail Care': 'Mani-pedi at home', 'Computer Technician': 'Laptop will not boot', 'Cellphone Repair': 'Replace cracked screen', 'CCTV Installation': 'Install 4 CCTV cameras' };
  const jobs = [];
  jobPlan.forEach((status, i) => {
    const created = ago(1 + i * 2, i % 24);
    const pp = professions[i % professions.length];
    const client = activeClients[(i + 2) % activeClients.length];
    const provider = ['in_progress', 'scheduled', 'completed'].includes(status) || (status === 'cancelled' && i % 2) ? activeProviders[i % activeProviders.length] : null;
    const quoted = i % 3 !== 0;
    const price = int(4, 60) * 100;
    const method = i % 4 === 0 ? 'xendit' : 'wallet';
    const j = {
      _id: oid(created), title: `${TITLES[pp.prof.name]} #${i}`,
      description: `Looking for ${pp.prof.name.toLowerCase()} help in ${pick(CITIES)}. Tools provided if needed.`,
      professionName: pp.prof.name, profession: pp.prof._id, categoryId: pp.cat._id, categoryName: pp.cat.name, category: pp.cat.name,
      serviceClass: i % 7 === 0 ? 'immediate' : 'standard',
      media: i % 5 === 0 ? [IMG(`job-${i}-a`), IMG(`job-${i}-b`)] : [],
      location: { address: `${int(1, 300)} Rizal St`, city: pick(CITIES), latitude: 14.5 + rnd() / 10, longitude: 121 + rnd() / 10 },
      locationDetails: 'Gate code at guardhouse', date: status === 'open' ? ahead(int(1, 20)) : ago(int(0, 60)),
      selectedDates: [ahead(int(1, 20))], timeWindows: ['morning'], paymentMethod: method, status,
      userId: client._id, assignedToId: provider?._id || null, acceptedProvider: provider?._id || null,
      budget: quoted ? 0 : price, agreedPrice: provider ? price : null, budgetType: 'fixed',
      paymentDetails: { method, isPaid: status === 'completed', paidAt: status === 'completed' ? ago(int(0, 30)) : null, feeStatus: status === 'completed' ? 'paid' : 'not_applicable' },
      paymentStatus: status === 'completed' ? 'paid' : provider ? 'escrow_held' : 'pending',
      escrowAmount: provider ? price : 0, paidAmount: status === 'completed' ? price : 0,
      escrowStatus: status === 'completed' ? 'released' : provider ? 'pending' : 'none',
      escrowReleaseAt: provider && status !== 'completed' ? ahead(2) : null,
      createdAt: created, updatedAt: ago(int(0, 5)),
    };
    if (status === 'completed') j.completionStatus = { clientConfirmed: true, providerConfirmed: true, paymentReleased: true, completedAt: ago(int(0, 30)), paymentReleasedAt: ago(int(0, 30)) };
    if (status === 'cancelled') j.cancellation = { cancelledAt: ago(int(0, 20)), cancelledBy: client._id, reason: pick(['Changed plans', 'Found another provider', 'Provider did not show up']), feeApplied: i % 2 ? 150 : null };
    jobs.push(j);
  });
  // Fixtures
  const jSearch = jobs[3]; jSearch.title = 'Repaint garage door ZEBRA-7'; jSearch.description = 'Unique smoke-test job for search.';
  const jHide = jobs[4]; const jDelete = jobs[6]; const jApps = jobs[1];
  const jQuote = jobs.find((j, i) => j.status === 'in_progress' && j.budget === 0 && i !== 12);
  const jHeld = jobs.find((j) => j.status === 'in_progress' && j !== jQuote && j.budget === 0);
  const jCompleted = jobs.find((j) => j.status === 'completed');
  const jCancelled = jobs.find((j) => j.status === 'cancelled');
  jobs[9].isHidden = true; jobs[9].hiddenAt = ago(3); jobs[9].hiddenBy = 'smoke.admin';
  jobs[40].isDeleted = true; jobs[40].deletedAt = ago(12); jobs[40].deletionReason = 'Policy violation'; jobs[40].deletedBy = 'olivia.ops@kayod.test';
  const jDispute = jobs[25];
  jDispute.completionStatus = { ...(jDispute.completionStatus || {}), paymentReleased: false, dispute: {
    isActive: true, raisedBy: 'client', raisedAt: ago(2), reason: 'Provider left the work unfinished',
    claims: [{ party: 'client', statement: 'The sink still leaks.', evidence: [IMG('evidence-c')], submittedAt: ago(2) }],
  } };
  jDispute.paymentStatus = 'escrow_held'; jDispute.escrowStatus = 'pending';

  // Held escrow on jHeld: the force-cancel path must refund it
  const heldAmount = 2400;
  const heldTx = { _id: oid(jHeld.createdAt), type: 'escrow_payment', amount: heldAmount, status: 'held', currency: 'PHP', fromUserId: jHeld.userId,
    toUserId: jHeld.assignedToId, jobId: jHeld._id, description: `Escrow hold for "${jHeld.title}"`, paymentMethod: 'wallet', createdAt: jHeld.createdAt, updatedAt: jHeld.createdAt };
  jHeld.agreedPrice = heldAmount; jHeld.escrowAmount = heldAmount;
  jHeld.paymentDetails = { ...jHeld.paymentDetails, isPaid: true, paidAt: jHeld.createdAt, heldTransaction: heldTx._id };
  await put(Job, jobs);
  await put(Transaction, [heldTx]);
  // client's wallet holds the escrow
  const heldWallet = out.wallets.find((w) => String(w.userId) === String(jHeld.userId));
  heldWallet.heldBalance = heldAmount; heldWallet.balance = heldWallet.availableBalance + heldAmount;
  Object.assign(ids, {
    jSearch: String(jSearch._id), jHide: String(jHide._id), jDelete: String(jDelete._id), jApps: String(jApps._id),
    jQuote: String(jQuote._id), jQuotePrice: jQuote.agreedPrice, jHeld: String(jHeld._id), jHeldClient: String(jHeld.userId), heldTx: String(heldTx._id), heldAmount,
    jCompleted: String(jCompleted._id), jCancelled: String(jCancelled._id), jDispute: String(jDispute._id), jHiddenSeed: String(jobs[9]._id), jDeletedSeed: String(jobs[40]._id),
  });

  // Quotes on open jobs — the app's applicants. kayod/server keeps one jobquotes
  // document per job with a quotes[] array (it has no Application model).
  const quoteDocs = [];
  jobs.filter((j) => j.status === 'open').slice(0, 6).forEach((j, k) => {
    const n = j === jApps ? 3 : 1 + (k % 3);
    const quotes = [];
    for (let a = 0; a < n; a++) {
      const p = activeProviders[(k * 3 + a) % activeProviders.length];
      quotes.push({ _id: oid(ago(1)), providerId: p._id, amount: (5 + a * 7 + k) * 100, status: a === 2 ? 'rejected' : 'pending',
        selectedDays: ['monday'], selectedArrivalWindows: ['morning'], submittedAt: ago(0, 1 + a * 3 + k) });
    }
    quoteDocs.push({ _id: oid(j.createdAt), jobId: j._id, quotes, totalQuotes: quotes.length, pendingQuotes: quotes.filter((q) => q.status === 'pending').length, createdAt: j.createdAt, updatedAt: ago(0, 1) });
  });
  putRaw('jobquotes', quoteDocs);
  const appsQuotes = quoteDocs.find((d) => String(d.jobId) === ids.jApps).quotes;
  ids.jAppsQuotes = appsQuotes.map((q) => ({ id: String(q._id), providerId: String(q.providerId), amount: q.amount, status: q.status }));

  // A completed top-up for the Money tab. The Top-up page names the user from
  // fromUserId, the Money tab totals by toUserId, so it carries both.
  await put(Transaction, [
    { _id: oid(ago(20)), type: 'xendit_topup', amount: 1500, status: 'completed', currency: 'PHP', fromUserId: clients[0]._id, toUserId: clients[0]._id, description: 'Wallet top-up via Xendit', paymentMethod: 'xendit', createdAt: ago(20), completedAt: ago(20) },
  ]);

  // Credential verifications: > 50 records so the list cap is visible.
  const docs = (tag) => ({ cloudinaryUrl: IMG(tag), publicId: `smoke/${tag}` });
  const vUsers = [...providers, ...clients.slice(2, 30)]; // 28 + 28 = 56 users
  const vStatuses = ['pending', 'under_review', 'approved', 'approved', 'rejected', 'resubmission_requested', 'flagged', 'approved'];
  const verifs = vUsers.map((u, k) => {
    const status = vStatuses[k % vStatuses.length];
    const submitted = ago(1 + k * 2, k % 12);
    return { userId: u._id, status, submittedAt: submitted, createdAt: submitted, updatedAt: submitted,
      faceVerification: [docs(`face-${k}-left`), docs(`face-${k}-front`), docs(`face-${k}-right`)], validId: [docs(`id-${k}-front`), docs(`id-${k}-back`)],
      credentials: u.userType === 'provider' ? [{ ...docs(`cert-${k}`), originalName: 'TESDA-NCII.pdf' }] : [],
      ...(['approved', 'rejected', 'resubmission_requested', 'flagged'].includes(status) ? { reviewedAt: ago(int(0, 10)), reviewedBy: admin._id, adminNotes: `${status} by admin` } : {}),
      ...(status === 'rejected' ? { rejectionReason: 'ID photo is blurry' } : {}) };
  });
  // The longest-waiting pending submission: oldest of all, so it is the first one a cap drops.
  const vOld = verifs[verifs.length - 1]; vOld.status = 'pending'; vOld.submittedAt = ago(200); vOld.createdAt = ago(200); vOld.updatedAt = ago(200);
  delete vOld.reviewedAt; delete vOld.reviewedBy; delete vOld.adminNotes; delete vOld.rejectionReason;
  // Fixed action targets near the top of the list (recent submissions).
  const setPending = (v, st) => { v.status = st; delete v.reviewedAt; delete v.reviewedBy; delete v.adminNotes; delete v.rejectionReason; };
  setPending(verifs[0], 'pending');      // approve
  setPending(verifs[1], 'pending');      // reject & ban
  setPending(verifs[2], 'under_review'); // request resubmission
  setPending(verifs[3], 'under_review'); // flag → dismiss prompt
  // Second attempt for user 4: attempt 1 rejected (older), attempt 2 approved (newer)
  const multiUser = vUsers[4];
  verifs[4].status = 'rejected'; verifs[4].rejectionReason = 'ID photo is blurry'; verifs[4].reviewedAt = ago(30); verifs[4].reviewedBy = admin._id;
  verifs[4].submittedAt = ago(35); verifs[4].createdAt = ago(35);
  verifs.push({ ...verifs[4], status: 'approved', rejectionReason: undefined, submittedAt: ago(0, 8), createdAt: ago(0, 8), updatedAt: ago(0, 8), reviewedAt: ago(0, 2), adminNotes: 'Clear photos on retry' });
  // Two more second attempts so the total clears 50 even after grouping noise
  verifs.push({ ...verifs[10], status: 'pending', submittedAt: ago(0, 4), createdAt: ago(0, 4), updatedAt: ago(0, 4), reviewedAt: undefined, reviewedBy: undefined, adminNotes: undefined, rejectionReason: undefined });
  verifs.push({ ...verifs[12], status: 'under_review', submittedAt: ago(0, 6), createdAt: ago(0, 6), updatedAt: ago(0, 6), reviewedAt: undefined, reviewedBy: undefined, adminNotes: undefined, rejectionReason: undefined });
  const verifRows = await put(CredentialVerification, verifs.map((v) => ({ _id: oid(v.submittedAt), ...v })));
  const vid = (v) => String(verifRows[verifs.indexOf(v)]._id);
  Object.assign(ids, {
    vApprove: vid(verifs[0]), vApproveUser: String(verifs[0].userId),
    vReject: vid(verifs[1]), vRejectUser: String(verifs[1].userId),
    vResub: vid(verifs[2]), vResubUser: String(verifs[2].userId),
    vFlag: vid(verifs[3]), vFlagUser: String(verifs[3].userId),
    vOld: vid(vOld), vOldUser: String(vOld.userId), vOldUserName: vUsers[vUsers.length - 1].name,
    vMultiUser: String(multiUser._id), vMultiUserName: multiUser.name,
    verificationCount: verifRows.length,
  });

  // Penalty history for the already-restricted client (Security Audit "Total Bans")
  await put(ActivityLog, [
    { adminId: admin._id, actionType: 'user_restricted', description: 'Restricted user for 7 days', targetType: 'user', targetModel: 'User', targetId: clients[3]._id, metadata: { reason: 'seed' }, ipAddress: '127.0.0.1', createdAt: ago(9), updatedAt: ago(9) },
    { adminId: admin._id, actionType: 'user_suspended', description: 'Suspended user for 3 days', targetType: 'user', targetModel: 'User', targetId: clients[3]._id, metadata: { reason: 'seed' }, ipAddress: '127.0.0.1', createdAt: ago(30), updatedAt: ago(30) },
  ]);

  putRaw('reviews', jobs.filter((j) => j.status === 'completed').slice(0, 8).map((j, k) => ({
    _id: oid(ago(k)), clientId: j.userId, providerId: j.acceptedProvider, jobId: j._id, rating: 3 + (k % 3), review: k % 2 ? 'Great work, on time.' : '', createdAt: ago(k),
  })));

  await seedWholeSystem({ ids, admins, pw, clients, providers, activeClients, activeProviders, jobs, jDispute });

  for (const [coll, rows] of Object.entries(out)) await db.collection(coll).insertMany(rows, { ordered: true });
  // Everything written after this moment was done during a test session.
  ids.seededAt = new Date().toISOString();
  const counts = Object.fromEntries(Object.entries(out).map(([c, r]) => [c, r.length]));
  fs.mkdirSync(path.join(__dirname, '.data'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '.data', 'fixture-ids.json'), JSON.stringify(ids, null, 2));
  console.log(JSON.stringify(counts));
  await mongoose.disconnect();
}
// Dashboard, Transactions, Support, Flagged, Settings and sign-in data. Runs
// after every earlier id and random number was drawn, so the users, jobs and
// verifications the first 43 cases use keep their names, ids and numbers.
async function seedWholeSystem({ ids, admins, pw, clients, providers, activeClients, activeProviders, jobs, jDispute }) {
  const EscrowRelease = M('EscrowRelease'), ChatSupport = M('ChatSupport'), Report = M('Report'),
    ReportedPost = M('ReportedPost'), Alert = M('Alert'), Advertisement = M('Advertisement');
  const [admin, olivia] = admins;
  const people = [...clients, ...providers];
  const nameOf = (uid) => people.find((u) => String(u._id) === String(uid)).name;
  const walletOf = (uid) => out.wallets.find((w) => String(w.userId) === String(uid));
  const rowOf = (Model, id) => out[Model.collection.name].find((r) => String(r._id) === String(id));
  // Change a row that was already validated, and validate it again.
  const patchRow = (Model, id, patch) => {
    const rows = out[Model.collection.name];
    const k = rows.findIndex((r) => String(r._id) === String(id));
    const m = new Model({ ...rows[k], ...patch });
    const err = m.validateSync();
    if (err) throw new Error(`${Model.modelName} patch: ${err.message}`);
    rows[k] = m.toObject({ virtuals: false, getters: false, depopulate: true });
  };
  const later = (at, ms) => new Date(at.getTime() + ms);
  const HOUR = 36e5, DAY = 864e5;

  // ── Staff accounts: two roles Admin Management can create but that cannot
  // sign in, and an admin whose access was turned off.
  const perms = (on) => Object.fromEntries(['dashboard', 'users', 'jobs', 'transactions', 'verifications', 'support', 'activity', 'flagged', 'settings'].map((p) => [p, on.includes(p)]));
  await put(User, [
    { name: 'Fiona Finance', email: 'fiona.finance@kayod.test', userType: 'finance', permissions: perms(['dashboard', 'transactions']) },
    { name: 'Sam Support', email: 'sam.support@kayod.test', userType: 'customer support', permissions: perms(['dashboard', 'users', 'support', 'flagged']) },
    { name: 'Dante Dormant', email: 'dante.dormant@kayod.test', userType: 'admin', permissions: perms(['dashboard', 'users', 'jobs', 'transactions', 'verifications', 'support', 'activity', 'flagged']),
      accountStatus: 'suspended', isRestricted: true,
      restrictionDetails: { type: 'suspended', reason: 'Admin access turned off by Smoke Admin', restrictedBy: admin._id, restrictedAt: ago(10), suspendedUntil: new Date(8.64e15), appealAllowed: false } },
  ].map((a, i) => ({ _id: oid(ago(200 - i)), accountStatus: 'active', ...a, password: pw, phone: `+63917000001${i}`, location: 'Admin Office',
    isVerified: true, lastLogin: ago(5 + i), createdAt: ago(200 - i), updatedAt: ago(5) })));
  // Three providers online now (Dashboard: Today's Activity)
  activeProviders.slice(20, 23).forEach((p) => { rowOf(User, p._id).isOnline = true; });

  // ── Money ──────────────────────────────────────────────────────────────
  const txs = [];
  const tx = (o) => { const t = { _id: oid(o.createdAt), currency: 'PHP', updatedAt: o.completedAt || o.failedAt || o.createdAt, ...o }; txs.push(t); return t; };

  // Platform fees, one per completed job (Fee Records; Dashboard revenue
  // chart and Pending Fees). The disputed job has not been paid out yet.
  const paidJobs = jobs.filter((j) => j.status === 'completed' && j !== jDispute);
  const feePlan = ['completed', 'completed', 'completed', 'pending', 'completed', 'failed', 'completed', 'completed', 'pending', 'completed', 'cancelled', 'completed', 'completed', 'completed', 'pending'];
  paidJobs.forEach((j, k) => {
    const at = ago(k * 4, 3 + k);
    const status = feePlan[k];
    tx({ type: 'platform_fee', amount: Math.round(j.agreedPrice * 0.1), status, fromUserId: j.acceptedProvider, jobId: j._id,
      description: `Platform fee for job: ${j.title}`, paymentMethod: 'wallet', createdAt: at, ...(status === 'completed' ? { completedAt: later(at, HOUR) } : {}) });
  });
  const asapJob = paidJobs.find((j) => j.serviceClass === 'immediate');
  tx({ type: 'platform_fee', amount: 50, status: 'completed', fromUserId: asapJob.userId, jobId: asapJob._id, description: `ASAP priority fee for job: ${asapJob.title}`,
    paymentMethod: 'wallet', createdAt: ago(1, 2), completedAt: ago(1, 2) });

  // Top-ups. The last one is pending: the backend's top-up auto-approver marks
  // it completed as soon as the backend starts — that is the defect T-04 shows.
  const tuPool = [...activeClients.slice(8, 14), ...activeProviders.slice(14, 18)];
  const tuPlan = ['completed', 'failed', 'completed', 'cancelled', 'completed', 'expired', 'completed', 'failed', 'completed', 'pending'];
  const XM = ['GCASH', 'PAYMAYA', 'CARD', 'GRABPAY', 'BPI_DIRECT_DEBIT'];
  const topups = tuPool.map((u, k) => {
    const at = k === 9 ? ago(0, 2) : ago(2 + k * 3, k);
    const status = tuPlan[k];
    return tx({ type: 'xendit_topup', amount: (2 + k * 3) * 250, status, fromUserId: u._id, toUserId: u._id, description: 'Wallet top-up via Xendit',
      paymentMethod: 'xendit', xenditId: `xnd_smoke_${String(k).padStart(3, '0')}`, metadata: { xenditPaymentMethod: XM[k % XM.length] }, createdAt: at,
      ...(status === 'completed' ? { completedAt: later(at, 6e4) } : {}) });
  });
  const tuPending = topups[9];
  ids.topupPending = { id: String(tuPending._id), user: nameOf(tuPending.toUserId), amount: tuPending.amount, xenditId: tuPending.xenditId,
    walletAvailable: walletOf(tuPending.toUserId).availableBalance };

  // Cash-outs (withdrawals)
  const wdPlan = ['pending', 'completed', 'completed', 'failed', 'pending', 'cancelled', 'completed', 'completed'];
  activeProviders.slice(5, 13).forEach((u, k) => {
    const at = ago(k * 5, 4 + k);
    const status = wdPlan[k];
    tx({ type: 'withdrawal', amount: (4 + k * 2) * 250, status, fromUserId: u._id, description: `Cash-out to ${k % 2 ? 'BPI' : 'GCash'}`, paymentMethod: 'bank_transfer',
      metadata: { channel: k % 2 ? 'BPI' : 'GCASH', accountName: u.name, accountNumber: `****${4100 + k * 37}` }, createdAt: at,
      ...(status === 'completed' ? { completedAt: later(at, DAY / 2) } : {}) });
  });

  // Refund requests: two waiting for a decision, two already decided. The
  // client asks (fromUserId) — approving credits fromUserId.
  const rfPlan = [[jobs[23], 'pending'], [jobs[27], 'pending'], [jobs[29], 'completed'], [jobs[31], 'failed']];
  const rfReason = ['The provider left before finishing', 'Charged for hours not worked', 'Provider did not show up', 'Work was redone by someone else'];
  const refunds = rfPlan.map(([j, status], k) => {
    const at = ago(k * 3 + 1, 2 + k);
    return tx({ type: 'refund_request', amount: j.agreedPrice, status, refundStatus: { pending: 'pending', completed: 'approved', failed: 'declined' }[status],
      fromUserId: j.userId, toUserId: j.acceptedProvider, jobId: j._id, description: `Refund request for job: ${j.title}`, paymentMethod: 'wallet',
      metadata: { reason: rfReason[k] }, createdAt: at,
      ...(status === 'completed' ? { completedAt: later(at, DAY) } : {}), ...(status === 'failed' ? { failedAt: later(at, DAY), failureReason: 'Declined by admin' } : {}) });
  });
  // The provider behind the first request has less than the refund in their wallet.
  const rfProviderWallet = walletOf(refunds[0].toUserId);
  rfProviderWallet.balance = 300; rfProviderWallet.availableBalance = 300; rfProviderWallet.heldBalance = 0;
  const refundIds = (t) => ({ id: String(t._id), client: nameOf(t.fromUserId), provider: nameOf(t.toUserId), amount: t.amount, job: t.description.replace('Refund request for job: ', ''),
    clientAvailable: walletOf(t.fromUserId).availableBalance, providerBalance: walletOf(t.toUserId).balance });
  ids.refundApprove = refundIds(refunds[0]);
  ids.refundDecline = refundIds(refunds[1]);

  // ── Disputes, each with its money where the ruling expects it ───────────
  // D1, completed job #25: completion captured the payment and scheduled the
  // release to the provider; the dispute froze it.
  const d1Amount = jDispute.agreedPrice;
  const d1Tx = tx({ type: 'escrow_payment', amount: d1Amount, status: 'completed', fromUserId: jDispute.userId, toUserId: jDispute.assignedToId, jobId: jDispute._id,
    description: `Escrow hold for "${jDispute.title}"`, paymentMethod: 'wallet', createdAt: ago(4), completedAt: ago(3) });
  patchRow(Job, jDispute._id, { paymentDetails: { ...rowOf(Job, jDispute._id).paymentDetails, isPaid: true, heldTransaction: d1Tx._id } });
  const d1Fee = Math.round(d1Amount * 0.1);
  await put(EscrowRelease, [{ _id: oid(ago(3)), jobId: jDispute._id, clientId: jDispute.userId, providerId: jDispute.assignedToId, escrowAmount: d1Amount,
    platformFee: d1Fee, netAmount: d1Amount - d1Fee, status: 'scheduled', scheduledFor: ahead(3), createdAt: ago(3), updatedAt: ago(3) }]);
  // D2, in-progress job #14: the payment is still held in the client's wallet.
  const jD2 = jobs[14];
  const d2Amount = jD2.agreedPrice;
  const d2Tx = tx({ type: 'escrow_payment', amount: d2Amount, status: 'held', fromUserId: jD2.userId, toUserId: jD2.assignedToId, jobId: jD2._id,
    description: `Escrow hold for "${jD2.title}"`, paymentMethod: 'wallet', createdAt: jD2.createdAt });
  const d2Row = rowOf(Job, jD2._id);
  patchRow(Job, jD2._id, {
    paymentDetails: { ...d2Row.paymentDetails, isPaid: true, paidAt: jD2.createdAt, heldTransaction: d2Tx._id },
    completionStatus: { ...(d2Row.completionStatus || {}), dispute: { isActive: true, raisedBy: 'client', raisedAt: ago(1), reason: 'Provider left after an hour; two doors still hang loose',
      claims: [{ party: 'client', statement: 'Two cabinet doors still hang loose.', evidence: [IMG('evidence-d2')], submittedAt: ago(1) }] } },
  });
  const d2Wallet = walletOf(jD2.userId);
  d2Wallet.heldBalance += d2Amount; d2Wallet.balance = d2Wallet.availableBalance + d2Wallet.heldBalance;
  const disputeIds = (j, amount, wallet) => ({ jobId: String(j._id), job: j.title, client: nameOf(j.userId), provider: nameOf(j.assignedToId), amount,
    ...(wallet ? { clientAvailable: wallet.availableBalance, clientHeld: wallet.heldBalance } : {}) });
  ids.disputePay = disputeIds(jDispute, d1Amount);
  ids.disputeRefund = disputeIds(jD2, d2Amount, d2Wallet);
  await put(Transaction, txs);

  // ── Support: 52 ordinary tickets — two more than the Support page loads
  // (it asks for the newest 50) — and a client + provider thread per dispute.
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const ticketIdFor = (k) => `${L[(k * 7) % 24]}${Math.floor(k / 10)}${L[(k * 3 + 5) % 24]}${k % 10}${L[(k * 11 + 2) % 24]}${(k * 7) % 10}${L[(k * 5 + 1) % 24]}${(k * 3) % 10}${L[(k * 13 + 4) % 24]}7`;
  const msg = (from, senderType, message, at, o = {}) => ({ _id: oid(at), senderId: from._id, senderName: from.name, senderType, message, timestamp: at,
    isRead: o.read ?? true, imageUrl: o.img || null, isInternal: !!o.internal });
  const SUBJ = [['Cannot upload profile photo', 'technical'], ['Top-up not reflected in wallet', 'payment'], ['How do I change my email?', 'account'], ['Provider arrived late', 'job'],
    ['Suggestion: dark mode', 'feedback'], ['Verification pending for a week', 'account'], ['Question about booking fees', 'general'], ['App freezes on the map screen', 'technical'],
    ['Cash-out still processing', 'payment'], ['Booking date shows the wrong day', 'job'], ['Cannot edit my service area', 'account'], ['Thank you, great service', 'feedback']];
  const tPool = [...activeClients.slice(7, 28), ...activeProviders.slice(3, 24)];
  const tickets = [];
  for (let k = 0; k < 52; k++) {
    const [subject, category] = k === 51 ? ['Cannot change my phone number', 'account'] : SUBJ[k % SUBJ.length];
    const u = tPool[(k * 5) % tPool.length];
    const at = ago(Math.floor(k * 1.2), 1 + (k % 20));
    const state = k === 0 || k === 51 ? 'new' : k <= 2 ? 'accepted' : k === 3 ? 'closed' : ['new', 'accepted', 'closed', 'closed', 'accepted', 'closed'][k % 6];
    const agent = k === 2 || (k > 3 && k % 4 === 1) ? olivia : admin;
    const um = (text, dt, o) => msg(u, 'User', text, later(at, dt), o);
    const am = (text, dt, o) => msg(agent, 'Admin', text, later(at, dt), o);
    const messages = [um(`Hi, ${subject.charAt(0).toLowerCase()}${subject.slice(1)}. Can you help?`, 0, { read: state !== 'new' })];
    if (k === 0) messages.push(um('', 6e4, { read: false, img: IMG('ticket-screenshot') }));
    const t = { _id: oid(at), ticketId: ticketIdFor(k), userId: u._id, userName: u.name, userEmail: u.email, subject, category,
      priority: k === 0 ? 'high' : ['low', 'medium', 'high', 'urgent', 'medium'][k % 5], status: state === 'closed' ? 'closed' : 'open', createdAt: at };
    if (state !== 'new') {
      Object.assign(t, { acceptedBy: agent._id, acceptedByName: agent.name, assignedTo: agent._id, assignedToName: agent.name, acceptedAt: later(at, HOUR) });
      messages.push(am('Thanks for reaching out. Looking into it now.', HOUR + 6e4));
      if (k === 1) messages.push(am('Xendit shows it paid; the wallet was not credited. Asked finance to check.', HOUR + 12e4, { internal: true }), um('Any update?', 2 * HOUR, { read: false }));
    }
    if (state === 'closed') {
      const closedAt = later(at, DAY);
      messages.push(am('This is sorted now, so I am closing the ticket.', DAY - 6e4));
      Object.assign(t, { closedAt, statusHistory: [{ status: 'resolved', performedBy: agent._id, performedByName: agent.name, timestamp: closedAt, reason: 'Issue resolved' }] });
    } else if (k % 5 === 4) {
      // A returning user: the Kayod app archives their earlier, closed ticket
      // here when they open a new one in the same conversation.
      t.ticketHistory = [{ ticketNumber: 1, subject: 'Booking question', category: 'general', openedAt: later(at, -20 * DAY), closedAt: later(at, -19 * DAY), resolvedBy: admin._id, messageCount: 3 }];
    }
    const shown = messages.filter((m) => !m.isInternal).at(-1);
    Object.assign(t, { messages, lastMessage: { text: shown.message || 'Sent an image', timestamp: shown.timestamp }, updatedAt: messages.at(-1).timestamp });
    tickets.push(t);
  }
  const ticketIds = (t) => ({ id: String(t._id), ticketId: t.ticketId, user: t.userName, subject: t.subject });
  Object.assign(ids, { tNew: ticketIds(tickets[0]), tMine: ticketIds(tickets[1]), tOlivia: ticketIds(tickets[2]), tClosed: ticketIds(tickets[3]), tOldest: ticketIds(tickets[51]) });
  [[jDispute, 'The ceiling fan wobbles and the light does not work.', 'The fan was fine when I left; the client changed the bulb afterwards.', ago(2)],
    [jD2, 'The provider left after an hour; two doors still hang loose.', 'I need hinges the client has not bought yet.', ago(1)]].forEach(([j, clientText, providerText, at], n) => {
    [[j.userId, clientText, 0], [j.assignedToId, providerText, 30 * 6e4]].forEach(([uid, text, dt], side) => {
      const u = people.find((p) => String(p._id) === String(uid));
      const t0 = later(at, dt);
      tickets.push({ _id: oid(t0), ticketId: ticketIdFor(60 + n * 2 + side), userId: u._id, userName: u.name, userEmail: u.email, subject: `Dispute: ${j.title}`,
        category: 'job', priority: 'high', status: 'open', metadata: { kind: 'dispute', jobId: String(j._id), jobTitle: j.title, disputeRaisedBy: 'client' },
        messages: [msg(u, 'User', text, t0, { read: false })], lastMessage: { text, timestamp: t0 }, createdAt: t0, updatedAt: t0 });
    });
  });
  await put(ChatSupport, tickets);

  // ── Flagged: reports (people, messages, reviews) and reported job posts.
  // The reported people are active providers no other case touches. Two
  // reports mention payment — the Flagged page drops those (F-07).
  const reviewed = (status, at) => (['dismissed', 'action_taken', 'escalated'].includes(status)
    ? { reviewedBy: admin._id, reviewedAt: later(at, DAY / 2), adminNotes: 'Reviewed with both parties', actionTaken: { dismissed: 'report_dismissed', action_taken: 'user_warned', escalated: 'escalated_to_dispute' }[status] } : {});
  const repPlan = [
    ['user', 'harassment', 'open', 'Kept messaging me late at night after the job was done.'],
    ['user', 'fake_profile', 'under_review', 'Profile photo is a stock image and the name does not match.'],
    ['job', 'scam_or_fraud', 'open', 'The post asks providers to buy a starter kit first.'],
    ['message', 'threats', 'open', 'Said they would come back to my house if I left a bad review.'],
    ['review', 'fake_review', 'open', 'Five glowing reviews from accounts made the same day.'],
    ['user', 'misconduct', 'open', 'Smoked inside the house during the job.'],
    ['user', 'unsolicited_solicitation', 'open', 'Asked me to send the payment to a personal GCash instead of through the app.'],
    ['payment', 'unauthorized_charge', 'open', 'I was charged twice for one booking.'],
    ['user', 'harassment', 'dismissed', 'Rude message, but we sorted it out.'],
    ['user', 'substandard_work', 'action_taken', 'Tiles came loose within a week.'],
    ['user', 'substandard_work', 'escalated', 'Leak came back; filed a dispute.'],
  ];
  const reviewRows = out.reviews;
  const reports = await put(Report, repPlan.map(([reportType, reason, status, comment], k) => {
    const at = ago(k, 3 + k);
    const target = reportType === 'job' ? jobs[8] : null;
    const reportedUserId = target ? target.userId : activeProviders[9 + k]._id;
    const relatedId = target ? target._id : reportType === 'review' ? reviewRows[0]._id : reportType === 'message' ? oid(at) : reportedUserId;
    return { _id: oid(at), reportType, reason, status, comment, reportedBy: activeClients[(k + 9) % activeClients.length]._id, reportedUserId, relatedId,
      ...(target ? { jobId: target._id } : {}), createdAt: at, updatedAt: at, ...reviewed(status, at) };
  }));
  const reportIds = (r) => ({ id: String(r._id), reported: nameOf(r.reportedUserId), reporter: nameOf(r.reportedBy), reason: r.reason, type: r.reportType });
  ids.reports = { harassment: reportIds(reports[0]), job: reportIds(reports[2]), threats: reportIds(reports[3]), misconduct: reportIds(reports[5]),
    hiddenSolicitation: reportIds(reports[6]), hiddenPayment: reportIds(reports[7]) };
  const rpPlan = [[jobs[2], 'spam', 'open', 'Same post appears three times with different prices.'],
    [jobs[5], 'misleading_information', 'open', 'Says one room but the photos show a whole house.'],
    [jobs[7], 'inappropriate_content', 'under_review', 'The description uses offensive language.'],
    [jobs[10], 'fake_job_posting', 'open', 'Poster never replies and the address does not exist.'],
    [jobs[0], 'duplicate_posting', 'dismissed', 'Looks like a copy of another post.']];
  const posts = await put(ReportedPost, rpPlan.map(([j, reason, status, comment], k) => {
    const at = ago(k, 6 + k);
    const r = activeProviders[3 + k];
    return { _id: oid(at), jobId: j._id,
      jobDetails: { title: j.title, description: j.description, category: j.categoryName, media: j.media, locationDetails: j.locationDetails, status: j.status, budget: j.budget, paymentMethod: j.paymentMethod, createdAt: j.createdAt },
      reportedByDetails: { providerId: r._id, providerName: r.name, providerEmail: r.email, providerUserType: 'provider', reportedAt: at },
      reportedBy: r._id, jobPosterId: j.userId, reportedUserId: j.userId, reason, comment, status, createdAt: at, updatedAt: at, ...reviewed(status, at) };
  }));
  const postIds = (p) => ({ id: String(p._id), job: p.jobDetails.title, jobId: String(p.jobId), poster: nameOf(p.jobPosterId), reason: p.reason });
  ids.posts = { spam: postIds(posts[0]), misleading: postIds(posts[1]), fake: postIds(posts[3]) };

  // ── Dashboard alerts. Real Alert rows (any at all) replace the alerts the
  // backend would otherwise make up from pending reports and verifications.
  await put(Alert, [
    { type: 'critical', category: 'reported_post', title: 'Threat reported', message: `${nameOf(reports[3].reportedUserId)} was reported for threats`, priority: 5, isActive: true, isRead: false, reportId: reports[3]._id, createdAt: ago(0, 1) },
    { type: 'warning', category: 'verification_request', title: 'Verification waiting since spring', message: `${ids.vOldUserName} has waited 200 days for a decision`, priority: 3, isActive: true, isRead: false, verificationId: ids.vOld, createdAt: ago(0, 3) },
    { type: 'info', category: 'support_ticket', title: 'New support message', message: `${tickets[0].userName}: ${tickets[0].subject}`, priority: 2, isActive: true, isRead: false, supportId: tickets[0]._id, createdAt: ago(0, 1) },
    { type: 'info', category: 'system', title: 'Scheduled maintenance', message: 'Maintenance window Sunday 2 AM', priority: 1, isActive: false, isRead: true, createdAt: ago(6) },
  ].map((a) => ({ _id: oid(a.createdAt), updatedAt: a.createdAt, ...a })));

  // ── App carousel ads. No ImageKit file ids, so deleting one calls nothing outside.
  await put(Advertisement, [
    { type: 'invite', title: 'Invite a friend', subtitle: 'You both get ₱100 off your next booking', highlight: '₱100', ctaLabel: 'Invite now', linkAction: 'Referrals', status: 'published', isActive: true, order: 0 },
    { type: 'offer', title: 'Aircon cleaning week', subtitle: 'Book any aircon cleaning before Sunday', highlight: '20% OFF', ctaLabel: 'Book now', linkAction: 'CreateJobScreen', status: 'published', isActive: true, order: 1 },
    { type: 'offer', title: 'Holiday deep clean', subtitle: 'Get the house ready for guests', highlight: '₱300 OFF', ctaLabel: 'Book', linkAction: 'CreateJobScreen', status: 'draft', isActive: false, order: 2 },
    { type: 'image', title: 'Rainy-season roof check', imageUrl: IMG('ad-roof-check'), imageFileId: '', linkAction: 'https://example.com/rainy-season', status: 'paused', isActive: false, order: 3 },
  ].map((a, k) => ({ _id: oid(ago(20 - k)), createdAt: ago(20 - k), updatedAt: ago(5 - k), ...a })));

  // ── Earlier sign-ins, so the Audit Log's Admins view has history
  await put(ActivityLog, [[olivia, ago(1, 2)], [olivia, ago(3, 5)], [admin, ago(2, 1)]].map(([a, at]) => (
    { adminId: a._id, actionType: 'admin_login', description: 'Signed in from Local Development', ipAddress: '127.0.0.1', createdAt: at, updatedAt: at })));
}

main().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });
