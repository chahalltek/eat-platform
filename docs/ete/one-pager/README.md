# ETE x Bullhorn one-pager

This folder holds the client-facing collateral for the Bullhorn integration.

- `architecture-diagram.svg` – reference architecture showing Bullhorn as system of record feeding the ETE intelligence layer and surfacing insights/recommendations/forecasts without writing back.
- `ete-one-pager.pdf` – one-page overview covering the problem, architecture, value, and SKUs.

To regenerate the PDF locally:

```bash
python - <<'PY'
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

output_path = "docs/ete/one-pager/ete-one-pager.pdf"
c = canvas.Canvas(output_path, pagesize=letter)
width, height = letter
margin = 50

def heading(text, y):
    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, y, text)
    return y - 18

def paragraph(text, y, leading=14, font_size=12):
    c.setFont("Helvetica", font_size)
    c.setFillColor(colors.HexColor("#111827"))
    for line in text.split("\n"):
        c.drawString(margin, y, line)
        y -= leading
    return y - 4

def draw_architecture_diagram(x, y):
    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.setFillColor(colors.HexColor("#f3f4f6"))
    c.roundRect(x, y - 110, 140, 100, 8, fill=1)
    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(x + 70, y - 20, "Bullhorn")
    c.setFont("Helvetica", 10)
    c.drawCentredString(x + 70, y - 35, "System of Record")
    c.setFillColor(colors.HexColor("#4b5563"))
    c.drawCentredString(x + 70, y - 50, "ATS, jobs, activity logs")

    c.setStrokeColor(colors.HexColor("#374151"))
    c.setLineWidth(2)
    c.line(x + 140, y - 60, x + 200, y - 60)
    c.setFont("Helvetica", 9)
    c.drawCentredString(x + 170, y - 75, "Secure API ingest")

    etex = x + 200
    c.setFillColor(colors.HexColor("#e0f2fe"))
    c.setStrokeColor(colors.HexColor("#38bdf8"))
    c.roundRect(etex, y - 140, 280, 180, 10, fill=1)
    c.setFillColor(colors.HexColor("#111827"))
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(etex + 140, y - 20, "ETE Intelligence Layer")

    def subblock(y_offset, title, note):
        c.setFillColor(colors.HexColor("#ecfeff"))
        c.setStrokeColor(colors.HexColor("#0891b2"))
        c.roundRect(etex + 10, y - y_offset, 260, 45, 6, fill=1)
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(etex + 140, y - y_offset + 30, title)
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.HexColor("#4b5563"))
        c.drawCentredString(etex + 140, y - y_offset + 15, note)

    subblock(70, "Data Ingestion & Governance", "Schema mapping, PII controls, quality checks")
    subblock(125, "Signals & Enrichment", "Engagement scoring, intent, supply signals")
    subblock(180, "Models & Orchestration", "Recommendations, forecasts, playbooks")

    out_x = etex + 280
    positions = [
        (y - 80, "Insights", "Dashboards & alerts"),
        (y - 135, "Recommendations", "Actions & automations"),
        (y - 190, "Forecasts", "Pipeline & revenue"),
    ]
    for y_pos, title, note in positions:
        c.setStrokeColor(colors.HexColor("#374151"))
        c.setLineWidth(2)
        c.line(out_x, y_pos, out_x + 50, y_pos - 10)
        c.setFillColor(colors.HexColor("#f3f4f6"))
        c.setStrokeColor(colors.HexColor("#d1d5db"))
        c.roundRect(out_x + 50, y_pos - 45, 120, 70, 8, fill=1)
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(out_x + 110, y_pos - 15, title)
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.HexColor("#4b5563"))
        c.drawCentredString(out_x + 110, y_pos - 30, note)

    c.setFillColor(colors.HexColor("#4b5563"))
    c.setFont("Helvetica", 9)
    c.drawString(x, y - 155, "Data flows from Bullhorn into ETE; outputs surface externally without writing back.")


y = height - margin - 10
c.setFillColor(colors.HexColor("#0f172a"))
c.setFont("Helvetica-Bold", 20)
c.drawString(margin, y, "ETE x Bullhorn One-Pager")
y -= 26
c.setFillColor(colors.HexColor("#4b5563"))
c.setFont("Helvetica", 11)
c.drawString(margin, y, "Reference architecture and commercial overview")
y -= 24

y = heading("Problem", y - 6)
problem = (
    "Bullhorn captures rich recruiter and client activity, but teams struggle to translate that data into "
    "actionable next steps and revenue confidence. Manual reporting, fragmented signals, and generic outreach "
    "create missed placements and slower growth."
)
y = paragraph(problem, y)

y = heading("Architecture", y)
draw_architecture_diagram(margin, y - 10)
y -= 200

y = heading("Value", y - 10)
value = (
    "* Increase recruiter productivity with AI-ranked desks and automated outreach cues.\n"
    "* Protect client relationships with early risk detection based on engagement gaps.\n"
    "* Improve revenue predictability through talent supply forecasting and conversion likelihood."
)
y = paragraph(value, y, leading=14, font_size=12)

y = heading("SKUs", y)
skus = (
    "1) ETE Intelligence Core – secure Bullhorn ingest, data quality, and governance.\n"
    "2) Signal & Enrichment Pack – engagement scoring, intent, and market supply overlays.\n"
    "3) Growth & Forecasting Pack – recommendations, playbooks, and revenue/talent forecasts."
)
paragraph(skus, y, leading=14, font_size=12)

c.showPage()
c.save()
print(f"Updated {output_path}")
PY
```
