import { handleFieldlotChatPost } from './server/fieldlot-chat-handler.js';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  try {
    const result = await handleFieldlotChatPost({
      messages: [{ role: 'user', content: 'Здравей, търся камион за слънчоглед от Добрич до Варна. Можеш ли да ми калкулираш колко ще струва горе-долу транспорта за 24 тона?' }],
      lang: 'bg'
    });
    console.log('Отговор от агента:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
})();
