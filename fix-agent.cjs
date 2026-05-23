const fs = require('fs');
let code = fs.readFileSync('server/fieldlot-agent-tools.ts', 'utf8');

// The file was corrupted by bash replacement of backticks or Bulgarian letters.
// Let's replace the whole block from 'case "calculate_transport_cost":' to the end.

const goodChunk = `			case 'calculate_transport_cost': {
				const km = typeof args.distance_km === 'number' ? args.distance_km : 0;
				const tons = typeof args.cargo_tons === 'number' ? args.cargo_tons : 0;
				const type = typeof args.truck_type === 'string' ? args.truck_type : 'standard';
				
				let ratePerKm = 2.0;
				if (type === 'refrigerated') ratePerKm = 2.5;
				if (type === 'tipper') ratePerKm = 2.2;
				
				// Apply a simple minimum distance cost if it's too short
				const effectiveKm = Math.max(km, 50); 
				
				const totalCostBgn = effectiveKm * ratePerKm;
				const costPerTonBgn = tons > 0 ? totalCostBgn / tons : 0;

				const data = {
					distance_km: km,
					cargo_tons: tons,
					truck_type: type,
					total_cost_bgn: Math.round(totalCostBgn),
					cost_per_ton_bgn: Math.round(costPerTonBgn * 100) / 100,
					note: 'Това е индикативна цена на база средни пазарни тарифи.'
				};

				const summary = ctx.lang === 'en' ? 'Calculated transport cost' : 'Калкулирана цена за транспорт';
				return {
					result: JSON.stringify({ ok: true, data }),
					action: { tool: name, ok: true, summary }
				};
			}

			case 'draft_negotiation': {
				const id = typeof args.listing_id === 'string' ? args.listing_id.trim() : '';
				const offer = typeof args.offer_price === 'string' ? args.offer_price.trim() : '';
				const tone = typeof args.tone === 'string' ? args.tone : 'polite';
				
				const item = getAllListings().find((l) => l.id === id);
				if (!item) {
					const msg = ctx.lang === 'en' ? \`Listing not found: \${id}\` : \`Няма обява: \${id}\`;
					return {
						result: JSON.stringify({ ok: false, error: msg }),
						action: { tool: name, ok: false, summary: msg },
					};
				}

				let draftText = '';
				if (ctx.lang === 'en') {
					draftText = \`Hello,\\n\\nI am contacting you regarding your listing for \${item.title} (ID: \${id}).\\n\\nI would like to propose a price of \${offer} for the requested quantity. Please let me know if you are open to discussing this.\\n\\nLooking forward to your reply.\\n\\nBest regards,\`;
				} else if (ctx.lang === 'de') {
					draftText = \`Guten Tag,\\n\\nich kontaktiere Sie bezüglich Ihres Inserats für \${item.title} (ID: \${id}).\\n\\nIch möchte Ihnen einen Preis von \${offer} für die gewünschte Menge vorschlagen. Bitte lassen Sie mich wissen, ob Sie gesprächsbereit sind.\\n\\nIch freue mich auf Ihre Antwort.\\n\\nMit freundlichen Grüßen,\`;
				} else {
					if (tone === 'firm') {
						draftText = \`Здравейте,\\n\\nПиша Ви относно обявата Ви за \${item.title} (ID: \${id}). Офертата ми е \${offer}. Ако това Ви устройва, моля свържете се с мен възможно най-скоро, за да придвижим сделката.\\n\\nПоздрави,\`;
					} else {
						draftText = \`Здравейте,\\n\\nСвързвам се с Вас относно обявата за \${item.title} (ID: \${id}).\\n\\nИмам сериозен интерес и бих искал да предложа цена от \${offer}. Моля, уведомете ме дали бихте обсъдили тази оферта или какви са Вашите условия.\\n\\nОчаквам Вашия отговор.\\n\\nПоздрави,\`;
					}
				}

				const data = {
					listing: listingSummary(item),
					offer_price: offer,
					draft_message: draftText
				};

				const summary = ctx.lang === 'en' ? 'Drafted negotiation message' : 'Съставено съобщение за преговори';
				return {
					result: JSON.stringify({ ok: true, data }),
					action: { tool: name, ok: true, summary }
				};
			}

			case 'clean_stale_listings': {
				const result = await runListingsSyncPipeline({ writeToDisk: true });
				const data = {
					kept: result.snapshot.count,
					pruned: result.snapshot.pruned
				};
				const summary = ctx.lang === 'en' ? \`Cleaned listings (pruned \${data.pruned})\` : \`Почистени обяви (изтрити \${data.pruned})\`;
				return {
					result: JSON.stringify({ ok: true, data }),
					action: { tool: name, ok: true, summary }
				};
			}

			case 'parse_pdf_document': {
				const base64 = typeof args.pdf_base64 === 'string' ? args.pdf_base64 : '';
				if (!base64) {
					return {
						result: JSON.stringify({ ok: false, error: 'No pdf_base64 provided' }),
						action: { tool: name, ok: false, summary: 'PDF Error' }
					};
				}
				
				try {
					// Dinamically import pdf-parse so it doesn't break if not installed
					const pdfParse = (await import('pdf-parse')).default;
					const buffer = Buffer.from(base64, 'base64');
					const data = await pdfParse(buffer);
					
					return {
						result: JSON.stringify({ ok: true, text: data.text }),
						action: { tool: name, ok: true, summary: 'PDF разчетен успешно' }
					};
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					return {
						result: JSON.stringify({ ok: false, error: msg }),
						action: { tool: name, ok: false, summary: 'Грешка при четене на PDF' }
					};
				}
			}

			case 'update_platform_knowledge': {
				const title = typeof args.title === 'string' ? args.title.trim() : 'Document';
				const content = typeof args.content === 'string' ? args.content.trim() : '';
				
				if (!content) {
					return {
						result: JSON.stringify({ ok: false, error: 'No content provided' }),
						action: { tool: name, ok: false, summary: 'Грешка: липсва съдържание' }
					};
				}
				
				const p = path.join(process.cwd(), 'data/platform-knowledge.json');
				let chunks: any[] = [];
				try {
					const raw = fs.readFileSync(p, 'utf8');
					const parsed = JSON.parse(raw);
					if (Array.isArray(parsed.chunks)) chunks = parsed.chunks;
				} catch {
					// ignore
				}
				
				chunks.push({
					id: \`doc-\${Date.now()}\`,
					text: \`=== \${title} ===\\n\${content}\`
				});
				
				fs.writeFileSync(p, JSON.stringify({ chunks }, null, '\\t') + '\\n', 'utf8');
				
				return {
					result: JSON.stringify({ ok: true, saved: true, total_chunks: chunks.length }),
					action: { tool: name, ok: true, summary: \`Документът '\${title}' е запазен в базата\` }
				};
			}

			default: {
				const msg = ctx.lang === 'en' ? \`Unknown tool: \${name}\` : \`Неизвестен инструмент: \${name}\`;
				return {
					result: JSON.stringify({ ok: false, error: msg }),
					action: { tool: name, ok: false, summary: msg },
				};
			}
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Tool execution failed';
		return {
			result: JSON.stringify({ ok: false, error: msg }),
			action: { tool: name, ok: false, summary: msg },
		};
	}
}`;

const startIndex = code.indexOf("			case 'calculate_transport_cost': {");
if (startIndex !== -1) {
    code = code.substring(0, startIndex) + goodChunk;
    fs.writeFileSync('server/fieldlot-agent-tools.ts', code);
    console.log("Success");
} else {
    console.log("Not found start");
}
