const express = require('express')
const app = express()
const cors = require('cors')
const { default: mongoose } = require('mongoose')
const User = require('./models/User')
const Post = require('./models/Post')
const cookieParser = require('cookie-parser')
const bcrypt = require('bcryptjs')
var salt = bcrypt.genSaltSync(10);
const jwt = require('jsonwebtoken')
const secret = 'gdsfkvbshgdysfgyehfhrivrg54rg56r35g4t68grdfsvhb'
const multer = require('multer')
const uploadMiddleware = multer({ dest: './uploads' })
const fs = require('fs')

app.use(cors({ credentials: true, origin: 'http://localhost:3000' }))
app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static(__dirname + '/uploads'))

mongoose.connect('mongodb+srv://blog_ketul:blog@cluster0.lzdlphr.mongodb.net/?retryWrites=true&w=majority', {

}).then(() => {
    console.log('databasse connected')
}).catch((err) => {
    console.log('sorry databse can not be connected', err)
})
app.post('/register', async (req, res) => {

    const { username, password } = req.body;
    try {
        const userDoc = await User.create({ username, password: bcrypt.hashSync(password, salt) })
        res.json(userDoc)
    }
    catch (err) {
        res.status(400).json(err)
    }
    console.log(username, password)
})

app.post('/login', async (req, res) => {

    // done by my understanding

    // const { username, password } = req.body;
    // try {
    //     if (!username || !password) {
    //         console.log('plz fill up all')
    //     }

    //     const check_username = await User.findOne({ username: username })
    //     if (check_username) {
    //         const match_username = await bcrypt.compare(password, check_username.password)

    //         if (match_username) {

    //             console.log('logged in successful')
    //             return res.status(401).json({ message: "user login successfull" })
    //         }
    //         else {
    //             console.log('no successful')
    //             res.status(400).json('not logged in // wrong credentials')
    //         }
    //     }
    //     else {
    //         console.log('no wrong successful')
    //         res.status(400).json('wrong credentials')
    //     }
    // }
    // catch (e) {
    //     console.log(e)
    // }

    const { username, password } = req.body;
    try {
        const userDoc = await User.findOne({ username: username });
        const passOk = bcrypt.compareSync(password, userDoc.password)

        if (passOk) {
            jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token).json({
                    id: userDoc._id,
                    username,
                })
            })
        }
        else {
            res.status(400).json('wrong credentials')
        }
    }
    catch (err) {
        res.status(400).json('wrong credentials')

    }
})


// app.post('/logout', (req, res) => {
//     res.cookie('token', '').json('ok')
// })
// app.get('/profile', (req, res) => {
//     const { token } = req.cookies
//     jwt.verify(token, secret, {}, (err, info) => {
//         if (err) throw err;
//         res.json(info)
//     })
// })

app.post('/logout', (req, res) => {
    res.clearCookie('token').json('ok');
});

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    console.log(req.cookies)
    if (!token) {
        return res.status(401).json('Unauthorized');
    }

    jwt.verify(token, secret, (err, info) => {
        if (err) {
            return res.status(401).json('Unauthorized');
        }
        res.json(info);
    });
});

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json('No file uploaded');
    }

    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const extension = parts[parts.length - 1];
    const newPath = path + '.' + extension;
    fs.renameSync(path, newPath);

    const { token } = req.cookies;
    jwt.verify(token, secret, async (err, info) => {
        if (err) {
            return res.status(401).json('Unauthorized');
        }
        const { title, summary, content } = req.body;
        const postDoc = await Post.create({
            title,
            summary,
            content,
            cover: newPath,
            author: info.id
        });
        res.json(postDoc);
    });
});

// app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
//     let newPath = null;
//     if (req.file) {
//         const { originalname, path } = req.file;
//         const parts = originalname.split('.');
//         const ext = parts[parts.length - 1];
//         newPath = path + '.' + ext;
//         fs.renameSync(path, newPath);
//     }

//     const { token } = req.cookies;
//     jwt.verify(token, secret, {}, async (err, info) => {
//         if (err) throw err;
//         const { id, title, summary, content } = req.body;
//         const postDoc = await Post.findById(id);
//         const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
//         if (!isAuthor) {
//             return res.status(400).json('you are not the author');
//         }
//         await postDoc.update({
//             title,
//             summary,
//             content,
//             cover: newPath ? newPath : postDoc.cover,
//         });

//         res.json(postDoc);
//     });

// });

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
    let newPath = null;
    if (req.file) {
        const { originalname, path } = req.file;
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
    }

    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, info) => {
        if (err) throw err;
        const { id, title, summary, content } = req.body;
        const postDoc = await Post.findById(id);
        const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
        if (!isAuthor) {
            return res.status(400).json('you are not the author');
        }
        postDoc.title = title;
        postDoc.summary = summary;
        postDoc.content = content;
        postDoc.cover = newPath ? newPath : postDoc.cover;

        await postDoc.save(); // Use the save method to update the document

        res.json(postDoc);
    });
});


app.get('/post', async (req, res) => {
    res.json(await Post.find().populate('author', ['username']).sort({ createdAt: -1 }).limit(20))
})

app.get('/post/:id', async (req, res) => {
    const { id } = req.params
    const postDoc = await Post.findById(id).populate('author', ['username'])
    res.json(postDoc)
})

// Add this route handler for deleting a blog post
app.delete('/post/:id', async (req, res) => {
    const { id } = req.params;
    const { token } = req.cookies;

    try {
        // Verify the token and get the user information (including the author ID)
        jwt.verify(token, secret, {}, async (err, info) => {
            if (err) {
                return res.status(401).json('Unauthorized');
            }

            // Find the post by its ID
            const postDoc = await Post.findById(id);

            // Check if the post exists
            if (!postDoc) {
                return res.status(404).json('Blog post not found');
            }

            // Check if the user making the request is the author of the blog post
            const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);

            if (!isAuthor) {
                return res.status(403).json('You are not the author');
            }

            // If the user is the author, delete the blog post
            await Post.deleteOne({ _id: id });

            // Optionally, you can delete the associated cover image file from the server
            if (postDoc.cover) {
                fs.unlinkSync(postDoc.cover);
            }

            res.json('Blog post deleted successfully');
        });
    } catch (error) {
        res.status(400).json('Error deleting blog post');
    }
});


app.listen(5000, () => {
    console.log(`listening backend on http://localhost:5000`)
})

