const fs = require("fs");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, TabStopType } = require("docx");

const B = (t, opts={}) => new TextRun({ text: t, bold: true, ...opts });
const T = (t, opts={}) => new TextRun({ text: t, ...opts });
const bullet = (children) => new Paragraph({ numbering: { reference: "b", level: 0 }, children, spacing: { after: 60 } });
const roleHead = (org, dates, title, loc) => [
  new Paragraph({ spacing: { before: 160, after: 20 },
    tabStops: [{ type: TabStopType.RIGHT, position: 10466 }],
    children: [B(org, { size: 22 }), T("\t"), B(dates, { size: 20 })] }),
  new Paragraph({ spacing: { after: 60 },
    tabStops: [{ type: TabStopType.RIGHT, position: 10466 }],
    children: [T(title, { italics: true, size: 20 }), T("\t"), T(loc, { italics: true, size: 18, color: "555555" })] })
];
const body = (t) => new Paragraph({ children: [T(t, { size: 20 })], spacing: { after: 80 } });

const doc = new Document({
  styles: { default: { document: { run: { font: "Aptos", size: 20 }, paragraph: { spacing: { line: 252 } } } } },
  numbering: { config: [{ reference: "b", levels: [{ level: 0, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 340, hanging: 200 } } } }] }] },
  sections: [{
    properties: { page: { margin: { top: 720, bottom: 720, left: 850, right: 850 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [B("Will Lilley", { size: 34 })], spacing: { after: 40 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
        children: [T("Leeds, UK · +44 7792 856207 · will.lilley93@gmail.com · References available on request", { size: 18, color: "444444" })] }),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [B("Professional Experience", { size: 24 })], spacing: { after: 60 } }),

      ...roleHead("Clara.co — legal operating platform for startups (DIFC, ADGM, Cayman, Delaware)", "Mar 23 – Present", "Product Operations Lead", "Hybrid Leeds / Dubai"),
      bullet([T("Owned technical product requirement writing across the platform: discovery with internal and client stakeholders, then structured, buildable specifications for engineering — plus the surrounding operations (Jira, Confluence, Scrum). Led the Confluence transformation into a structured knowledge base for Designers, Engineers and QA.", { size: 20 })]),
      bullet([T("Spearheaded Clara's AI initiative: built a RAG-based LLM agent (n8n) and authored the 1,500+ pages of jurisdictional and regulatory knowledge it runs on (ADGM, Dubai, Cayman, Delaware — Company, Foundation and Trust regulations). Requirements written for a machine to consume: the agent serves Sales, Service and Engineering without pulling knowledge specialists off specialist work.", { size: 20 })]),
      bullet([T("Led enterprise n8n automation linking PandaDoc, Xero, HubSpot, Teams, NocoDB and Trello into a queryable business context; my flows have automated 1,000+ invoices and removed manual handoffs between sales, finance and operations.", { size: 20 })]),
      bullet([T("Produced and maintained startup compliance and data-protection documentation, including a DPIA.", { size: 20 })]),

      ...roleHead("Clara Money — USD banking for UAE businesses (Column API)", "May 24 – Dec 24", "Product Operations Lead (Secondment)", "Hybrid Leeds / Dubai"),
      bullet([T("Worked with the Head of Product (ex-Head of Engineering, Citibank) from germination to successful launch in six months, responding to post-SVB demand for USD accounts.", { size: 20 })]),
      bullet([T("Defined compliance-driven product specifications against Column's KYC requirements and ADGM, UAE and US banking regulation — the specifications the launch permission depended on. Specified back-end modules for sanctions-screening of payment recipients and rules-based suspicious-transaction monitoring.", { size: 20 })]),

      ...roleHead("Simmons & Simmons LLP (Wavelength)", "Dec 19 – Dec 22", "Senior Legal Engineer", "Hybrid Leeds / London"),
      bullet([T("Advised financial institutions on regulatory processes including FCA investigations and large-scale compliance assessments; held the room with GCs and Heads of IT. Automated due diligence, contract review and litigation workflows.", { size: 20 })]),
      bullet([T("Designed and ran “Legal Scrum”, embedding agile delivery and cross-functional collaboration between tenured lawyers and data engineers.", { size: 20 })]),
      bullet([T("Built data-driven legal strategies: contributed to a £120m tax litigation defence and used LLM transformers (2021) to show opposing counsel's witness statements were plagiarised.", { size: 20 })]),

      ...roleHead("Memery Crystal LLP", "Sep 17 – Dec 19", "Associate, Commercial Litigation", "London"),
      bullet([T("High-value commercial litigation (Supreme Court, Commercial Court): disclosure, interlocutory applications, trial preparation; built Excel-based fund-flow analysis tooling. Cited for drafting: “logical and coherent… the best drafting skills they have seen in a Trainee”.", { size: 20 })]),

      body("Earlier: TLB (The Law Boutique) — Senior Legal Operations Consultant to corporate legal teams (Jan–Mar 23) · Callcredit — credit-reference service desk, VBA data processing (2016) · Yorkshire Bank — business banking associate (2014–16)."),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [B("Independent product and specification systems", { size: 24 })], spacing: { before: 120, after: 60 } }),
      bullet([B("Opbox", { size: 20 }), T(" — shipped product built and operated under agent governance ⟨CONFIRM: one line on what Opbox does⟩.", { size: 20 })]),
      bullet([B("Boltrig", { size: 20 }), T(" — shipped product ⟨CONFIRM: one line on what Boltrig does⟩.", { size: 20 })]),
      bullet([B("Vibe Proof System", { size: 20 }), T(" — a Lean 4-verified governance kernel for AI-assisted work: the statute book is code, its legitimacy is a compile-time theorem, and properties like “every denial names its law” are proved rather than promised.", { size: 20 })]),
      bullet([B("VPS Factory", { size: 20 }), T(" — a prose→proof requirements pipeline on that kernel: intake to typed IR, mechanical faithfulness checks, human sign-off as the load-bearing gate, then Lean verdicts. This exercise was run through it.", { size: 20 })]),

      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [B("Education", { size: 24 })], spacing: { before: 120, after: 60 } }),
      bullet([T("The University of Law, Leeds — LPC with MSc Law and Business, Distinction (2017); GDL, Commendation (2016)", { size: 20 })]),
      bullet([T("Newcastle University — BA (Hons) English Language and Literature, 2.1 (2015); Outstanding Contribution to Student Media (President, NSR)", { size: 20 })])
    ]
  }]
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync("/tmp/Will Lilley CV.docx", b); console.log("written", b.length); });
