from fastapi import APIRouter

from app.schemas import CalculatorFertilizerIn, CalculatorProfitIn

router = APIRouter(prefix="/calculators", tags=["calculators"])


@router.post("/fertilizer")
def fertilizer_calc(body: CalculatorFertilizerIn):
	total_n = body.area_ha * body.nitrogen_kg_per_ha
	bags_25kg = total_n / 25
	return {
		"crop": body.crop,
		"area_ha": body.area_ha,
		"nitrogen_needed_kg": round(total_n, 1),
		"bags_25kg": round(bags_25kg, 1),
		"note": "Демо калкулатор — консултирайте агроном.",
	}


@router.post("/profit")
def profit_calc(body: CalculatorProfitIn):
	costs = body.seed_cost + body.fertilizer_cost + body.fuel_cost + body.labor_cost + body.other_cost
	profit = body.revenue - costs
	margin = (profit / body.revenue * 100) if body.revenue else 0
	return {
		"revenue": body.revenue,
		"total_costs": round(costs, 2),
		"profit": round(profit, 2),
		"margin_pct": round(margin, 1),
	}


@router.post("/yield")
def yield_calc(area_ha: float, yield_per_ha: float, price_per_unit: float):
	total = area_ha * yield_per_ha
	revenue = total * price_per_unit
	return {
		"total_yield": round(total, 2),
		"estimated_revenue": round(revenue, 2),
	}
