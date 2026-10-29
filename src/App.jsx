import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Code2,
  Clapperboard,
  Palette,
  BriefcaseBusiness,
  Users,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Search,
  CalendarDays,
  ChevronRight,
  X,
  RefreshCw,
  Mail,
  ShieldCheck,
  AlertCircle,
  LogOut,
  LockKeyhole,
  Eye,
  EyeOff,
  MessageCircle,
} from "lucide-react";

const teams = [
  { name: "Web Development", icon: Code2 },
  { name: "Video Editing", icon: Clapperboard },
  { name: "Graphic Design", icon: Palette },
  { name: "Sales", icon: BriefcaseBusiness },
];
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const subjectForDate = (value) => {
  const [year, month, day] = value.split("-");
  return "Daily Work Report - " + day + "/" + month + "/" + year;
};
const initials = (n) =>
  n
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export default function App() {
  const [authState, setAuthState] = useState("checking");
  const [date, setDate] = useState(today);
  const [team, setTeam] = useState("All");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [payload, setPayload] = useState({
    mode: "loading",
    employees: [],
    reports: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        "/api/reports?date=" + encodeURIComponent(date),
        { cache: "no-store" },
      );
      if (response.status === 401) {
        setAuthState("login");
        setPayload({ mode: "loading", employees: [], reports: [] });
        return;
      }
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Unable to fetch reports",
        );
      setPayload(await response.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [date]);
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d) => setAuthState(d.authenticated ? "yes" : "login"))
      .catch(() => setAuthState("login"));
  }, []);
  useEffect(() => {
    if (authState === "yes") fetchReports();
  }, [fetchReports, authState]);
  useEffect(() => {
    if (authState !== "yes") return;
    const t = setInterval(fetchReports, 60000);
    return () => clearInterval(t);
  }, [fetchReports, authState]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const { employees, reports, mode } = payload;
  const reportByEmail = useMemo(
    () => new Map(reports.map((r) => [r.email.toLowerCase(), r])),
    [reports],
  );
  const received = employees.filter((p) =>
    reportByEmail.has(p.email.toLowerCase()),
  ).length;
  const missing = employees.filter(
    (p) => !reportByEmail.has(p.email.toLowerCase()),
  );
  function makeReminder(pending) {
    return (
      "Hello Team,\n\nThe following employees have not yet submitted their Daily Work Report for " +
      date +
      ":\n\n" +
      pending.map((p, i) => i + 1 + ". " + p.name).join("\n") +
      "\n\nKindly send your work report to info@umnni.com with the subject:\n" +
      subjectForDate(date) +
      "\n\n" +
      (date === today() ? "Please send it before 11:59 PM IST.\n\n" : "") +
      "If you have already submitted your report, please ignore this reminder.\n\nThank you,\nHR Team"
    );
  }
  async function freshReminder() {
    setPreparing(true);
    setError("");
    try {
      const response = await fetch(
        "/api/reports?date=" + encodeURIComponent(date),
        { cache: "no-store" },
      );
      if (response.status === 401) {
        setAuthState("login");
        throw new Error("Session expired. Please sign in again.");
      }
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Could not refresh pending reports",
        );
      const current = await response.json();
      if (current.mode !== "live")
        throw new Error(
          "Gmail data is not live yet. Reminder cannot be prepared.",
        );
      setPayload(current);
      const done = new Set(current.reports.map((r) => r.email.toLowerCase()));
      return current.employees.filter((p) => !done.has(p.email.toLowerCase()));
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setPreparing(false);
    }
  }
  async function shareReminder() {
    // Open a window during the user click, before awaiting the Gmail refresh.
    const tab = window.open("about:blank", "_blank");
    const pending = await freshReminder();
    if (!pending || !pending.length) {
      tab?.close();
      return;
    }
    const url =
      "https://api.whatsapp.com/send?text=" +
      encodeURIComponent(makeReminder(pending));
    if (tab) tab.location.href = url;
    else window.location.href = url;
  }
  const rows = employees.filter(
    (p) =>
      (team === "All" || p.team === team) &&
      (!search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.email.toLowerCase().includes(search.toLowerCase())) &&
      (status === "all" ||
        (status === "received"
          ? reportByEmail.has(p.email.toLowerCase())
          : !reportByEmail.has(p.email.toLowerCase()))),
  );
  if (authState === "checking")
    return (
      <div className="authloading">
        <LockKeyhole size={26} />
        <p>Checking HR access...</p>
      </div>
    );
  if (authState !== "yes")
    return <Login onSuccess={() => setAuthState("yes")} />;
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    setPayload({ mode: "loading", employees: [], reports: [] });
    setAuthState("login");
  };
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">u.</span>
          <div>
            <strong>UMNNI</strong>
            <small>HR WORKSPACE</small>
          </div>
        </div>
        <div className="navgroup">WORKSPACE</div>
        <button
          className={"navitem " + (team === "All" ? "active" : "")}
          onClick={() => setTeam("All")}
        >
          <LayoutDashboard size={18} /> Daily Reports
        </button>
        <div className="navgroup deptlabel">DEPARTMENTS</div>
        {teams.map((t) => (
          <button
            key={t.name}
            className={"navitem " + (team === t.name ? "active" : "")}
            onClick={() => setTeam(t.name)}
          >
            <t.icon size={18} />
            <span>{t.name}</span>
            <span className="navnumber">
              {employees.filter((p) => p.team === t.name).length}
            </span>
          </button>
        ))}
        <div className="sidefooter">
          <ShieldCheck size={17} />
          <div>
            <b>HR workspace</b>
            <span>Read-only report overview</span>
          </div>
        </div>
        <button className="logout" onClick={logout}>
          <LogOut size={16} /> Log out
        </button>
      </aside>
      <main className="main">
        <div className="top">
          <div>
            <span className="eyebrow">PEOPLE & PRODUCTIVITY</span>
            <h1>
              Daily Work Reports <span className="spark">✳</span>
            </h1>
            <p>
              Every team's daily update, beautifully organized in one place.
            </p>
          </div>
          <div className="profile">
            <span>
              <b>HR Workspace</b>
              <small>Report overview</small>
            </span>
            <div className="avatar">HR</div>
          </div>
        </div>
        <div className={"notice " + (mode === "live" ? "live" : "")}>
          <Mail size={17} />
          <span>
            {mode === "live" ? (
              <>
                <b>Gmail connected.</b> Only approved employee report emails are
                shown.
              </>
            ) : (
              <>
                <b>Demo preview.</b> These are sample employees and reports.
                Gmail is not connected yet.
              </>
            )}
          </span>
          <button
            title="Refresh reports"
            onClick={fetchReports}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
          </button>
        </div>
        <div className="scheduleinfo">
          <Clock3 size={17} />
          <div>
            <b>Office hours: 9:30 AM – 7:30 PM IST</b>
            <span>
              Reports accepted from 9:30 AM to 11:59 PM IST. Required subject:{" "}
              <strong>{subjectForDate(date)}</strong> (not case-sensitive).
            </span>
          </div>
        </div>
        {error && (
          <div className="error">
            <AlertCircle size={17} />
            {error}
          </div>
        )}
        <section className="stats">
          <Stat
            icon={Users}
            title="Total Employees"
            count={employees.length}
            sub="Across all departments"
          />
          <Stat
            icon={CheckCircle2}
            title="Reports Received"
            count={received}
            sub="For selected date"
          />
          <Stat
            icon={Clock3}
            title="Pending Reports"
            count={employees.length - received}
            sub="Yet to be submitted"
            kind="pending"
          />
          <Stat
            icon={TrendingUp}
            title="Submission Rate"
            count={
              (employees.length
                ? Math.round((received / employees.length) * 100)
                : 0) + "%"
            }
            sub="Overall completion"
            kind="rate"
          />
        </section>
        <section className="worktop">
          <div>
            <h2>Team overview</h2>
            <p>Select a department to see employee reports.</p>
          </div>
          <div className="controls">
            <label className="datecontrol">
              <CalendarDays size={16} />
              <input
                type="date"
                aria-label="Report date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="search">
              <Search size={17} />
              <input
                placeholder="Search employee..."
                aria-label="Search employee"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
        </section>
        <div className="teams">
          {teams.map((t) => {
            const members = employees.filter((p) => p.team === t.name);
            const done = members.filter((p) =>
              reportByEmail.has(p.email.toLowerCase()),
            ).length;
            return (
              <button
                key={t.name}
                className={"team " + (team === t.name ? "selected" : "")}
                onClick={() => setTeam(team === t.name ? "All" : t.name)}
              >
                <div className="teamtitle">
                  <b>{t.name}</b>
                  <t.icon size={20} />
                </div>
                <div className="teamnumbers">
                  <span>
                    <b>
                      {done}/{members.length}
                    </b>{" "}
                    submitted
                  </span>
                  <span>
                    {members.length
                      ? Math.round((done / members.length) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width:
                        (members.length ? (done / members.length) * 100 : 0) +
                        "%",
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
        <section className="panel">
          <div className="panelbar">
            <div>
              <h3>
                {team === "All" ? "All employee reports" : team + " reports"}
              </h3>
              <small>
                {date} · {rows.length} matching employees
              </small>
            </div>
            <div className="pills">
              {["all", "received", "pending"].map((s) => (
                <button
                  key={s}
                  className={status === s ? "chosen" : ""}
                  onClick={() => setStatus(s)}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Received at</th>
                  <th>Work report</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const report = reportByEmail.get(p.email.toLowerCase());
                  return (
                    <tr key={p.email}>
                      <td>
                        <div className="person">
                          <div className="initials">{initials(p.name)}</div>
                          <div>
                            <b>{p.name}</b>
                            <small>{p.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>{p.team}</td>
                      <td>
                        <span
                          className={"tag " + (report ? "received" : "pending")}
                        >
                          {report ? "Received" : "Pending"}
                        </span>
                      </td>
                      <td className={!report ? "muted" : ""}>
                        {report ? report.time + " IST" : "—"}
                      </td>
                      <td>
                        <button
                          className="view"
                          disabled={!report}
                          onClick={() => setSelected({ person: p, report })}
                        >
                          {report ? (
                            <>
                              View report <ChevronRight size={14} />
                            </>
                          ) : (
                            "No report"
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="empty">
                      No employees match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <div
          className="reminder-button-row"
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 22,
            marginBottom: 12,
          }}
        >
          <button
            className="reminder-only-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 11,
              padding: "15px 24px",
              border: "1px solid #128b62",
              borderRadius: 12,
              background: "linear-gradient(135deg,#20b77c 0%,#10865e 100%)",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 800,
              fontFamily: "inherit",
              boxShadow: "0 8px 22px rgba(16,134,94,.22)",
              cursor:
                mode === "live" &&
                !loading &&
                !preparing &&
                !error &&
                missing.length > 0
                  ? "pointer"
                  : "not-allowed",
              opacity:
                mode === "live" &&
                !loading &&
                !preparing &&
                !error &&
                missing.length > 0
                  ? 1
                  : 0.55,
              transition: "transform .2s ease, box-shadow .2s ease",
            }}
            disabled={
              mode !== "live" ||
              loading ||
              preparing ||
              !!error ||
              missing.length === 0
            }
            onClick={shareReminder}
          >
            <MessageCircle size={19} strokeWidth={2.5} />
            {preparing
              ? "Checking latest reports..."
              : missing.length === 0
                ? "All Reports Received"
                : "Send WhatsApp Reminder"}
          </button>
        </div>
        <footer>
          UMNNI · HR Daily Report Dashboard{" "}
          {mode === "demo" ? "· Demo mode" : ""}
        </footer>
      </main>
      {selected && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
          >
            <div className="modalhead">
              <h2 id="report-title">Daily work report</h2>
              <button onClick={() => setSelected(null)} aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="details">
              <div>
                <b>Employee</b>
                <span>{selected.person.name}</span>
              </div>
              <div>
                <b>Email</b>
                <span>{selected.person.email}</span>
              </div>
              <div>
                <b>Team</b>
                <span>{selected.person.team}</span>
              </div>
              <div>
                <b>Date & time</b>
                <span>
                  {date} · {selected.report.time} IST
                </span>
              </div>
              <div>
                <b>Subject</b>
                <span>{selected.report.subject}</span>
              </div>
            </div>
            <h4>Work summary</h4>
            <div className="reportbody">
              {selected.report.body || "No text content found in email."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Stat({ icon: Icon, title, count, sub, kind = "" }) {
  return (
    <div className={"stat " + kind}>
      <div className="stathead">
        <span>{title}</span>
        <span className="staticon">
          <Icon size={19} />
        </span>
      </div>
      <strong>{count}</strong>
      <small>{sub}</small>
    </div>
  );
}
function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Login failed");
      onSuccess();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="loginpage">
      <div className="loginart">
        <div className="loginbrand">
          <span className="logo">u.</span>
          <div>
            <b>UMNNI</b>
            <small>HR WORKSPACE</small>
          </div>
        </div>
        <div className="loginmessage">
          <span className="eyebrow">YOUR WORKSPACE, SIMPLIFIED</span>
          <h1>
            Every update.
            <br />
            One clear view.
          </h1>
          <p>
            A calmer way to track your team's daily progress and stay on top of
            every report.
          </p>
          <div className="logindecor">
            <div>
              <Users size={20} /> 17 team members
            </div>
            <div>
              <CheckCircle2 size={20} /> 4 departments
            </div>
          </div>
        </div>
        <div className="loginbottom">UMNNI · Internal HR Portal</div>
      </div>
      <div className="loginright">
        <form className="loginbox" onSubmit={submit}>
          <div className="loginlock">
            <LockKeyhole size={23} />
          </div>
          <span className="eyebrow">SECURE HR ACCESS</span>
          <h2>Welcome back</h2>
          <p>Sign in to access your daily work report dashboard.</p>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter HR username"
          />
          <label htmlFor="password">Password</label>
          <div className="passwordfield">
            <input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
            <button
              type="button"
              aria-label={show ? "Hide password" : "Show password"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && (
            <div className="loginerror">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          <button type="submit" className="loginbutton" disabled={busy}>
            {busy ? "Signing in..." : "Sign in to dashboard"}{" "}
            <ChevronRight size={18} />
          </button>
          <div className="loginhint">
            <ShieldCheck size={15} /> Authorized HR access only
          </div>
        </form>
      </div>
    </div>
  );
}
