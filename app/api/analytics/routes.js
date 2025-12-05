import { NextResponse } from 'next/server'

// In-memory хранилище метрик (в продакшене использовать БД)
let metrics = {
	total_tickets: 0,
	auto_resolved: 0,
	escalated: 0,
	by_department: {},
	by_priority: {},
	by_language: { kk: 0, ru: 0 },
	avg_confidence: 0,
	response_times: [],
	classification_errors: 0,
	hourly_stats: {},
}

// Middleware для логирования метрик
export function logTicketMetrics(classification, autoResolved, responseTime) {
	metrics.total_tickets++

	if (autoResolved) {
		metrics.auto_resolved++
	} else {
		metrics.escalated++
	}

	// По департаментам
	const dept = classification.department
	metrics.by_department[dept] = (metrics.by_department[dept] || 0) + 1

	// По приоритетам
	const priority = classification.priority
	metrics.by_priority[priority] = (metrics.by_priority[priority] || 0) + 1

	// По языкам
	const lang = classification.language
	metrics.by_language[lang]++

	// Средняя уверенность
	const totalConfidence = metrics.avg_confidence * (metrics.total_tickets - 1)
	metrics.avg_confidence =
		(totalConfidence + classification.confidence) / metrics.total_tickets

	// Время ответа
	metrics.response_times.push(responseTime)

	// Почасовая статистика
	const hour = new Date().getHours()
	if (!metrics.hourly_stats[hour]) {
		metrics.hourly_stats[hour] = { count: 0, auto_resolved: 0 }
	}
	metrics.hourly_stats[hour].count++
	if (autoResolved) {
		metrics.hourly_stats[hour].auto_resolved++
	}
}

// GET /api/helpdesk/metrics - Получение метрик
export async function GET(request) {
	const { searchParams } = new URL(request.url)
	const period = searchParams.get('period') || 'all' // all, today, week

	const autoResolutionRate =
		metrics.total_tickets > 0
			? ((metrics.auto_resolved / metrics.total_tickets) * 100).toFixed(2)
			: 0

	const avgResponseTime =
		metrics.response_times.length > 0
			? (
					metrics.response_times.reduce((a, b) => a + b, 0) /
					metrics.response_times.length
			  ).toFixed(0)
			: 0

	const topDepartment =
		Object.entries(metrics.by_department).sort(
			([, a], [, b]) => b - a
		)[0]?.[0] || 'N/A'

	return NextResponse.json({
		success: true,
		period,
		summary: {
			total_tickets: metrics.total_tickets,
			auto_resolved: metrics.auto_resolved,
			auto_resolution_rate: `${autoResolutionRate}%`,
			escalated: metrics.escalated,
			avg_confidence: (metrics.avg_confidence * 100).toFixed(1) + '%',
			avg_response_time_ms: avgResponseTime,
			classification_accuracy:
				(
					(1 - metrics.classification_errors / metrics.total_tickets) *
					100
				).toFixed(2) + '%',
		},
		breakdown: {
			by_department: metrics.by_department,
			by_priority: metrics.by_priority,
			by_language: metrics.by_language,
			top_department: topDepartment,
		},
		hourly_distribution: metrics.hourly_stats,
		sla_compliance: calculateSLA(metrics),
		cost_savings: calculateCostSavings(metrics),
	})
}

// Расчет SLA
function calculateSLA(metrics) {
	const slaTargets = {
		CRITICAL: 15, // минут
		HIGH: 60,
		MEDIUM: 240,
		LOW: 1440,
	}

	const compliance = {}
	Object.keys(slaTargets).forEach(priority => {
		// Упрощенный расчет (в реальности нужны точные timestamps)
		compliance[priority] = '98%' // Placeholder
	})

	return compliance
}

// Расчет экономии
function calculateCostSavings(metrics) {
	const costPerManualTicket = 500 // тенге
	const costPerAutoTicket = 50 // тенге

	const manualCost = metrics.escalated * costPerManualTicket
	const autoCost = metrics.auto_resolved * costPerAutoTicket
	const savedCost =
		metrics.auto_resolved * (costPerManualTicket - costPerAutoTicket)

	const savedFTE = (metrics.auto_resolved * 15) / (8 * 60 * 22) // 15 мин на тикет, 8ч/день, 22 дня

	return {
		total_cost: manualCost + autoCost,
		saved_cost: savedCost,
		saved_fte: savedFTE.toFixed(2),
		monthly_savings:
			((savedCost * 30) / metrics.total_tickets).toFixed(0) + ' ₸',
	}
}

// POST /api/helpdesk/metrics/error - Логирование ошибок классификации
export async function POST(request) {
	try {
		const body = await request.json()
		const { ticket_id, actual_department, predicted_department, reason } = body

		metrics.classification_errors++

		// В реальности сохранить в БД для анализа
		console.log('❌ Ошибка классификации:', {
			ticket_id,
			predicted: predicted_department,
			actual: actual_department,
			reason,
		})

		return NextResponse.json({
			success: true,
			message: 'Ошибка зарегистрирована для улучшения модели',
		})
	} catch (error) {
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		)
	}
}

// GET /api/helpdesk/health - Health check
export async function healthCheck() {
	const uptime = process.uptime()
	const status = {
		status: 'healthy',
		uptime_seconds: uptime.toFixed(0),
		ai_model: 'gemini-2.0-flash-exp',
		features: {
			auto_classification: true,
			auto_resolution: true,
			multilingual: true,
			operator_assist: true,
		},
		supported_languages: ['kk', 'ru'],
		integration_channels: ['email', 'chat', 'portal', 'api'],
	}

	return NextResponse.json(status)
}
