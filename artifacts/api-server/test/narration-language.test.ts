import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectBriefLanguage, resolveNarrationLanguage } from '../src/lib/voiceover.js';

test('detects the language of the customer brief from its script', () => {
  assert.equal(detectBriefLanguage('اصنع فيديو لمتجر الورد الخاص بي')?.code, 'ar');
  assert.equal(detectBriefLanguage('Создай ролик для моего магазина цветов')?.code, 'ru');
  assert.equal(detectBriefLanguage('मेरी दुकान के लिए एक वीडियो बनाओ')?.code, 'hi');
  assert.equal(detectBriefLanguage('내 꽃집을 위한 영상을 만들어줘')?.code, 'ko');
  assert.equal(detectBriefLanguage('私の花屋のための動画を作って')?.code, 'ja');
  assert.equal(detectBriefLanguage('为我的花店制作一个视频')?.code, 'zh');
  assert.equal(detectBriefLanguage('میری دکان کے لیے ایک ویڈیو بناؤ ٹھیک ہے')?.code, 'ur');
});

test('detects common Latin-script languages and leaves English alone', () => {
  assert.equal(detectBriefLanguage('Crea un video para nuestra tienda con los mejores productos')?.code, 'es');
  assert.equal(detectBriefLanguage('Crée une vidéo pour notre boutique avec des fleurs')?.code, 'fr');
  assert.equal(detectBriefLanguage('Erstelle ein Video für unser Geschäft und die Blumen')?.code, 'de');
  assert.equal(detectBriefLanguage('Create a video for our flower shop with the best bouquets'), null);
  assert.equal(detectBriefLanguage(''), null);
  assert.equal(detectBriefLanguage('ok'), null);
});

test('auto follows the prompt; an explicit choice or explicit request still wins', () => {
  assert.equal(resolveNarrationLanguage('اصنع فيديو لمتجري', null, 'auto').code, 'ar');
  assert.equal(resolveNarrationLanguage('اصنع فيديو لمتجري', null, 'fr').code, 'fr');
  assert.equal(resolveNarrationLanguage('اصنع فيديو لمتجري in French', null, 'auto').code, 'fr');
  assert.equal(resolveNarrationLanguage('Make a promo video', 'de-DE', 'auto').code, 'de');
  assert.equal(resolveNarrationLanguage('Make a promo video', null, undefined).code, 'en');
});
