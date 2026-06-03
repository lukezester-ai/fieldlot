import {
	MARKET_TOOLS,
	VISION_TOOLS,
	COPYWRITER_TOOLS,
	ADMIN_TOOLS,
	GENERAL_TOOLS,
} from './server/fieldlot-agent-tools.js';

console.log('Market:', MARKET_TOOLS?.length);
console.log('Vision:', VISION_TOOLS?.length);
console.log('Copywriter:', COPYWRITER_TOOLS?.length);
console.log('Admin:', ADMIN_TOOLS?.length);
console.log('General:', GENERAL_TOOLS?.length);
