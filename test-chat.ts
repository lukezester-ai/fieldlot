import { handleFieldlotChatPost } from './server/fieldlot-chat-handler.js';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  try {
    const result = await handleFieldlotChatPost({
      messages: [{ role: 'user', content: 'какви са цените на пшеницата' }],
      context: { lang: 'bg' }
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('ERROR:', err);
  }
})();
