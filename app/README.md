# Flask Auth Server - PRODUCTION

## Быстрый старт

```bash
cd app
pip install -r requirements.txt
python app.py
```

Сервер запустится на http://localhost:5000

## Настройки

Файл `.env`:
- `PROVIDER_MODE=gomaxer` - реальная отправка SMS
- `GOMAXER_BOT_ID=123456` - ID бота для Gomaxer
- `GOMAXER_PAGE_PATH=/s/knife` - путь страницы

## Как работает

1. Вводишь РЕАЛЬНЫЙ российский номер (+79XXXXXXXXX)
2. Отправляется РЕАЛЬНОЕ SMS через Gomaxer
3. Вводишь код из SMS
4. Готово!

**ВАЖНО:** Это PRODUCTION версия с реальной отправкой SMS!
