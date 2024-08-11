const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // خدمة الملفات الثابتة من مجلد 'public'

const CLIENT_ID = '1271525481044246671'; // استبدل بـ Client ID الخاص بك
const CLIENT_SECRET = 'jgOWHvyy5jTX2kT4DamsAnObj-5OKgXz'; // استبدل بـ Client Secret الخاص بك
const REDIRECT_URI = 'http://localhost:3000/callback'; // استبدل بـ URI التحويل الخاص بك

// صفحة تسجيل الدخول
app.get('/auth/discord', (req, res) => {
  const redirectUri = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify email`;
  res.redirect(redirectUri);
});


// صفحة تحويل OAuth2
app.get('/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const response = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      scope: 'identify'
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const { access_token } = response.data;
    const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });

    const user = userResponse.data;
    res.send(`
      <script>
        // تخزين معرف المستخدم وتوكن الوصول في مكان يمكن الوصول إليه في المستقبل
        localStorage.setItem('discordUserId', '${user.id}');
        localStorage.setItem('discordToken', '${access_token}');
        // توجيه المستخدم إلى الصفحة الرئيسية بعد تسجيل الدخول بنجاح
        window.location.href = '/';
      </script>
    `);
  } catch (error) {
    console.error('Error:', error);
    res.send('حدث خطأ أثناء تسجيل الدخول.');
  }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
