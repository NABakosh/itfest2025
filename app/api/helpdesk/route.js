import { GoogleGenAI } from '@google/genai'
import { NextResponse } from 'next/server'

const apiKey = process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey })
const MODEL_NAME = 'gemini-2.0-flash-exp'

const knowledgeBase = {
	password_reset: {
		kk: 'Құпия сөзді қалпына келтіру үшін: 1) https://portal.company.kz/reset бетіне кіріңіз 2) Email енгізіңіз 3) Хатты тексеріп, нұсқауларды орындаңыз',
		ru: 'Для сброса пароля: 1) Перейдите на https://portal.company.kz/reset 2) Введите email 3) Проверьте почту и следуйте инструкциям',
	},
	vpn_access: {
		kk: 'VPN қосылу үшін: 1) Cisco AnyConnect орнатыңыз 2) vpn.company.kz адресін қосыңыз 3) Корпоративтік тіркелгі деректерімен кіріңіз',
		ru: 'Для подключения VPN: 1) Установите Cisco AnyConnect 2) Добавьте адрес vpn.company.kz 3) Войдите с корпоративными учетными данными',
	},
	email_setup: {
		kk: 'Email баптау: 1) Outlook ашыңыз 2) Файл > Тіркелгі қосу 3) Email және құпия сөзді енгізіңіз 4) Автоматты баптау аяқталуын күтіңіз',
		ru: 'Настройка email: 1) Откройте Outlook 2) Файл > Добавить учетную запись 3) Введите email и пароль 4) Дождитесь автоматической настройки',
	},
	printer_issue: {
		kk: 'Принтер мәселесі: 1) Принтер қосулы екенін тексеріңіз 2) Кезекті тазалаңыз 3) Драйверді қайта орнатыңыз 4) Көмек керек болса тикет жасаңыз',
		ru: 'Проблема с принтером: 1) Проверьте подключение 2) Очистите очередь печати 3) Переустановите драйвер 4) Создайте тикет если нужна помощь',
	},
	software_install: {
		kk: 'Бағдарлама орнату: Software Center арқылы керекті бағдарламаны іздеңіз. Тізімде жоқ болса, тикет жасаңыз',
		ru: 'Установка ПО: Найдите нужную программу через Software Center. Если нет в списке - создайте тикет',
	},
}

const departments = {
	IT_INFRASTRUCTURE: {
		keywords: [
			'server',
			'network',
			'vpn',
			'firewall',
			'сервер',
			'желі',
			'желі',
			'брандмауэр',
		],
		priority_boost: ['critical', 'өте маңызды', 'критично'],
	},
	IT_SUPPORT: {
		keywords: [
			'password',
			'email',
			'outlook',
			'laptop',
			'құпия сөз',
			'компьютер',
			'ноутбук',
		],
		priority_boost: [],
	},
	SOFTWARE_DEV: {
		keywords: [
			'bug',
			'feature',
			'api',
			'database',
			'қате',
			'функция',
			'дерекқор',
		],
		priority_boost: ['production', 'өндіріс'],
	},
	HR_IT: {
		keywords: [
			'onboarding',
			'offboarding',
			'access',
			'жұмысқа қабылдау',
			'қол жеткізу',
		],
		priority_boost: [],
	},
	SECURITY: {
		keywords: [
			'security',
			'breach',
			'phishing',
			'malware',
			'қауіпсіздік',
			'вирус',
		],
		priority_boost: ['urgent', 'шұғыл', 'срочно'],
	},
}

const classificationPrompt = `Ты - интеллектуальная система маршрутизации Help Desk.

ЗАДАЧА: Проанализируй обращение пользователя и верни JSON с классификацией.

ДЕПАРТАМЕНТЫ:
- IT_INFRASTRUCTURE: серверы, сети, VPN, инфраструктура
- IT_SUPPORT: пароли, email, рабочие станции, принтеры
- SOFTWARE_DEV: баги, новые функции, API, базы данных
- HR_IT: онбординг, доступы для новых сотрудников
- SECURITY: безопасность, фишинг, вирусы, инциденты безопасности

ПРИОРИТЕТЫ:
- LOW: типовые вопросы, не срочные
- MEDIUM: влияет на работу пользователя
- HIGH: блокирует работу, влияет на несколько человек
- CRITICAL: массовые проблемы, безопасность, продакшн

ТИПЫ:
- QUESTION: вопрос
- INCIDENT: проблема, требующая решения
- REQUEST: запрос на доступ/ПО/оборудование
- CHANGE: изменение конфигурации

КАТЕГОРИИ ТИПОВЫХ ИНЦИДЕНТОВ:
- password_reset
- vpn_access
- email_setup
- printer_issue
- software_install
- other

Отвечай ТОЛЬКО валидным JSON без дополнительного текста:
{
  "department": "код_департамента",
  "priority": "уровень",
  "type": "тип",
  "category": "категория или other",
  "language": "kk или ru",
  "summary": "краткое резюме на языке обращения (макс 100 символов)",
  "is_auto_solvable": true/false,
  "confidence": 0.0-1.0
}`

function detectLanguage(text) {
	const kazakhChars = /[ӘәІіҢңҒғҮүҰұҚқӨөҺһ]/
	return kazakhChars.test(text) ? 'kk' : 'ru'
}

export async function POST(request) {
	try {
		const body = await request.json()
		const { prompt, action = 'classify' } = body

		if (!prompt) {
			return NextResponse.json(
				{ success: false, error: 'Поле "prompt" обязательно' },
				{ status: 400 }
			)
		}

		const detectedLang = detectLanguage(prompt)

		switch (action) {
			case 'classify':
				return await classifyTicket(prompt, detectedLang)

			case 'assist':
				return await assistOperator(prompt, detectedLang)

			case 'translate':
				return await translateText(prompt, body.targetLang || 'ru')

			case 'summarize':
				return await summarizeConversation(prompt, detectedLang)

			default:
				return NextResponse.json(
					{ success: false, error: 'Неизвестное действие' },
					{ status: 400 }
				)
		}
	} catch (error) {
		console.error('Ошибка API:', error)
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		)
	}
}

async function classifyTicket(prompt, language) {
	console.log(`🎯 Классификация тикета на языке: ${language}`)

	try {
		const response = await ai.models.generateContent({
			model: MODEL_NAME,
			contents: [
				{
					role: 'user',
					parts: [{ text: `${classificationPrompt}\n\nОБРАЩЕНИЕ:\n${prompt}` }],
				},
			],
			generationConfig: {
				temperature: 0.1,
				maxOutputTokens: 500,
			},
		})

		let classification = JSON.parse(
			response.text.replace(/```json|```/g, '').trim()
		)

		if (
			classification.is_auto_solvable &&
			classification.category !== 'other'
		) {
			const autoSolution = knowledgeBase[classification.category]?.[language]

			if (autoSolution) {
				return NextResponse.json({
					success: true,
					auto_resolved: true,
					classification,
					solution: autoSolution,
					message:
						language === 'kk'
							? '✅ Сіздің сұрауыңыз автоматты түрде шешілді'
							: '✅ Ваш запрос решен автоматически',
				})
			}
		}

		return NextResponse.json({
			success: true,
			auto_resolved: false,
			classification,
			assigned_to: classification.department,
			message:
				language === 'kk'
					? `📋 Тикет ${classification.department} бөліміне бағытталды`
					: `📋 Тикет направлен в отдел ${classification.department}`,
			estimated_response: getEstimatedResponse(classification.priority),
		})
	} catch (error) {
		console.error('Ошибка классификации:', error)
		throw error
	}
}

async function assistOperator(prompt, language) {
	console.log(`💬 Помощь оператору на языке: ${language}`)

	const assistPrompt =
		language === 'kk'
			? `Сіз Help Desk операторының көмекшісісіз. Келесі сұрауға профессионалды жауап жазыңыз:\n\n${prompt}\n\nЖауап тек қазақ тілінде болуы керек.`
			: `Ты помощник оператора Help Desk. Составь профессиональный ответ на следующий запрос:\n\n${prompt}\n\nОтвет должен быть только на русском языке.`

	try {
		const response = await ai.models.generateContent({
			model: MODEL_NAME,
			contents: [{ role: 'user', parts: [{ text: assistPrompt }] }],
			generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
		})

		return NextResponse.json({
			success: true,
			suggested_response: response.text,
			language,
		})
	} catch (error) {
		console.error('Ошибка генерации ответа:', error)
		throw error
	}
}

// Перевод текста
async function translateText(text, targetLang) {
	console.log(`🌐 Перевод на язык: ${targetLang}`)

	const langNames = { kk: 'казахский', ru: 'русский', en: 'английский' }
	const translatePrompt = `Переведи следующий текст на ${langNames[targetLang]} язык. Верни ТОЛЬКО перевод без комментариев:\n\n${text}`

	try {
		const response = await ai.models.generateContent({
			model: MODEL_NAME,
			contents: [{ role: 'user', parts: [{ text: translatePrompt }] }],
			generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
		})

		return NextResponse.json({
			success: true,
			original: text,
			translated: response.text,
			target_language: targetLang,
		})
	} catch (error) {
		console.error('Ошибка перевода:', error)
		throw error
	}
}

// Резюмирование переписки
async function summarizeConversation(conversation, language) {
	console.log(`📝 Резюмирование на языке: ${language}`)

	const summaryPrompt =
		language === 'kk'
			? `Келесі қолдау диалогын қысқаша түйіндеңіз (3-5 сөйлем):\n\n${conversation}\n\nТүйін тек қазақ тілінде болуы керек.`
			: `Составь краткое резюме следующего диалога поддержки (3-5 предложений):\n\n${conversation}\n\nРезюме должно быть только на русском языке.`

	try {
		const response = await ai.models.generateContent({
			model: MODEL_NAME,
			contents: [{ role: 'user', parts: [{ text: summaryPrompt }] }],
			generationConfig: { temperature: 0.5, maxOutputTokens: 500 },
		})

		return NextResponse.json({
			success: true,
			summary: response.text,
			language,
		})
	} catch (error) {
		console.error('Ошибка резюмирования:', error)
		throw error
	}
}

function getEstimatedResponse(priority) {
	const estimates = {
		CRITICAL: '15 минут',
		HIGH: '1 час',
		MEDIUM: '4 часа',
		LOW: '24 часа',
	}
	return estimates[priority] || '24 часа'
}
