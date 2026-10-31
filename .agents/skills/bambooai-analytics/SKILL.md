---
name: bambooai-analytics
description: LLM-driven persistent Python analytical engine and verifiable business telemetry environment. Use when analyzing datasets, financial numbers, store conversion funnels, e-commerce metrics, or generating reproducible computational reports.
---

# BambooAI Business & Telemetry Analytics Skill

**BambooAI** is a data analysis environment built around a persistent Python computational kernel, an explicit multi-turn analysis protocol, and an inspectable, reproducible computational ledger.

## Core Architectural Principles

1. **Iterative Analysis in Persistent Kernel**:
   - The Analyst works turn-by-turn. Rather than hallucinating a final analytical plan in one shot, it inspects data structures, runs exploratory cells, reads intermediate outputs, and builds follow-up queries dynamically.

2. **Transactional Execution**:
   - Every committed code cell is checkpointed. If a calculation fails or encounters an exception, attempted state mutations are rolled back to preserve kernel integrity.

3. **Evidence-Linked Results**:
   - Numerical figures cited in the executive report are directly bound to the execution cell that calculated them. Conclusions are traceable directly to the underlying raw rows and metrics.

4. **Reproduction & Verification**:
   - Before completing an analysis, the selected pipeline of computational cells is re-executed against the pristine raw dataset in a fresh kernel. If the replayed numbers mismatch, the discrepancy is flagged immediately.

5. **Adaptive Reviewer Protocol**:
   - A dedicated Reviewer role periodically audits the Analyst's methodology, checks for statistical biases, and requests sensitivity tests before signing off on strategic conclusions.

## E-Commerce & ATELIER V21 Analytics Workflows

### 1. Revenue & Order Performance
```python
# Analyze revenue trajectory, AOV (Average Order Value), and payment methods
import pandas as pd
import numpy as np

orders_df = pd.read_json("orders_export.json")
aov = orders_df["total_amount"].mean()
revenue_by_day = orders_df.groupby(orders_df["created_at"].dt.date)["total_amount"].sum()
```

### 2. Funnel & Drop-off Analysis
- Track visitor sessions from Homepage -> Cinematic 3D View -> Product Detail Page -> Cart -> Razorpay Checkout.
- Calculate step-by-step conversion rates and detect high-friction drop-off points.

### 3. Inventory Velocity & Stock Run-out Forecasting
- Calculate days-of-inventory-remaining per SKU based on 7-day and 30-day moving sales velocity.
- Identify top re-order priorities and stale items for targeted promotions.
