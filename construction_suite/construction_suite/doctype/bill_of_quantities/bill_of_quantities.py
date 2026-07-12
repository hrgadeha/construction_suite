# Copyright (c) 2026, Hardik Gadesha and contributors
# For license information, please see license.txt

import math

from frappe.model.document import Document
from frappe.utils import flt

DIAMETER_HOLES_PER_DAY_BREAKPOINTS = [
	(300, 6),
	(500, 3),
	(750, 2),
	(1000, 1),
	(1500, 0.5),
	(1800, 0.33),
]
DIAMETER_HOLES_PER_DAY_FALLBACK = 0.25

CONCRETE_HARDNESS_FACTORS = {
	"normal": 1.0,
	"reinforced": 1.2,
	"high_grade": 1.5,
	"pile_cap": 2.0,
}


def get_holes_per_day(diameter_mm):
	for max_mm, holes_per_day in DIAMETER_HOLES_PER_DAY_BREAKPOINTS:
		if diameter_mm <= max_mm:
			return holes_per_day
	return DIAMETER_HOLES_PER_DAY_FALLBACK


def parse_diameter_mm(diameter):
	digits = "".join(ch for ch in (diameter or "") if ch.isdigit())
	return int(digits) if digits else 600


class BillofQuantities(Document):
	def validate(self):
		self.calculate_total_mob_days()
		self.calculate_estimated_coring_work_days()
		self.calculate_total_days()
		self.calculate_machinery_amounts()
		self.calculate_manpower_amounts()
		self.calculate_diamond_bit_consumable()
		self.calculate_total_machinery_cost()
		self.calculate_mobilisation_costs()
		self.calculate_total_management_and_compliance_cost()
		self.calculate_sub_total()
		self.calculate_grand_total()

	def calculate_total_mob_days(self):
		self.total_mob_days = flt(self.mob_days) + flt(self.demob_days)

	def calculate_estimated_coring_work_days(self):
		holes = flt(self.no_of_holes)
		days_per_coring_point = flt(self.days_per_coring_point)
		holes_per_day = get_holes_per_day(parse_diameter_mm(self.diameter))
		if days_per_coring_point > 0:
			coring_work_days = math.ceil(holes * days_per_coring_point)
		else:
			coring_work_days = math.ceil(holes / holes_per_day) if holes_per_day else 0
		self.estimated_coring_work_days = coring_work_days

	def calculate_total_days(self):
		self.total_days = flt(self.estimated_coring_work_days) + flt(self.mob_days) + flt(self.demob_days)

	def calculate_machinery_amounts(self):
		for row in self.machinery_list:
			row.machine_amount = flt(row.qty) * flt(row.rate) * flt(row.no_of_days)
			row.mob_amount = flt(row.qty) * flt(row.mob_premium)
			row.amount = row.machine_amount + row.mob_amount

	def calculate_manpower_amounts(self):
		total_manpower = 0
		total_manpower_cost = 0
		for row in self.manpower_list:
			row.amount = flt(row.qty) * flt(row.rate) * flt(row.no_of_days)
			total_manpower += flt(row.qty)
			total_manpower_cost += flt(row.amount)
		self.total_manpower = total_manpower
		self.total_manpower_cost = total_manpower_cost

	def get_hardness_factor(self):
		for fieldname, factor in CONCRETE_HARDNESS_FACTORS.items():
			if self.get(fieldname):
				return factor
		return 1

	def calculate_diamond_bit_consumable(self):
		total_linear_metres = flt(self.no_of_holes) * flt(self.depth)
		hardness_factor = self.get_hardness_factor()
		self.diamond_bit_consumable_amount = flt(self.diamond_bit_consumable) * hardness_factor * total_linear_metres

	def calculate_total_machinery_cost(self):
		machinery_rows_cost = sum(flt(row.machine_amount) for row in self.machinery_list)
		self.total_machinery_cost = machinery_rows_cost + flt(self.diamond_bit_consumable_amount)

	def calculate_mobilisation_costs(self):
		mob_total_days = flt(self.mob_days) + flt(self.demob_days)
		base_mob_and_demob = mob_total_days * flt(self.mobilisation_cost_rate)
		equipment_premiums = sum(flt(row.mob_amount) for row in self.machinery_list)
		self.base_mob_and_demob = base_mob_and_demob
		self.equipment_premiums = equipment_premiums
		self.total_mob_cost = base_mob_and_demob + equipment_premiums

	def calculate_total_management_and_compliance_cost(self):
		total_days = flt(self.total_days)
		lump_sum_costs = (
			flt(self.pe_lifting_plan)
			+ flt(self.nce)
			+ flt(self.pe_calculation)
			+ flt(self.impact_assessment)
		)
		per_day_costs = (
			flt(self.ptw_management) + flt(self.noise_vib_monitor) + flt(self.waste_management)
		) * total_days
		diesel_cost = flt(self.diesel_rate) * flt(self.diesel_consumption) * total_days
		overhead_base = flt(self.total_manpower_cost) + flt(self.total_machinery_cost)
		overhead_cost = overhead_base * (flt(self.overhead) / 100) + flt(self.overhead_lump_sum)
		additional_compliance_cost = sum(
			flt(row.amount) for row in self.additional_compliance_items_list
		)

		self.total_management_and_compliance_cost = (
			lump_sum_costs + per_day_costs + diesel_cost + overhead_cost + additional_compliance_cost
		)

	def calculate_sub_total(self):
		self.sub_total = (
			flt(self.total_mob_cost)
			+ flt(self.total_manpower_cost)
			+ flt(self.total_machinery_cost)
			+ flt(self.total_management_and_compliance_cost)
		)

	def calculate_grand_total(self):
		sub_total = flt(self.sub_total)
		contingency_amount = sub_total * (flt(self.contingency) / 100)
		profit_margin_amount = (sub_total + contingency_amount) * (flt(self.profit_margin) / 100)
		self.contingency_amount = contingency_amount
		self.profit_margin_amount = profit_margin_amount
		self.grand_total = sub_total + contingency_amount + profit_margin_amount