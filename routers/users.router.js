import express from "express";
import { prisma } from "../models/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from "../middlewares/need-signin.middlewares.js";
import env from "dotenv";

env.config();

const router = express.Router();

router.post("/sign-up", async (req, res, next) => {
  try {
    const { email, password, password2, name } = req.body;

    if (!email) {
      return res.status(400).json({ message: "이메일은 필수값입니다." });
    }

    if (!password) {
      return res.status(400).json({ message: "비밀번호는 필수값입니다." });
    }

    if (!password2) {
      return res.status(400).json({ message: "비밀번호 확인은 필수값입니다." });
    }

    // //비밀번호 확인과 일치하는지 확인
    if (password !== password2) {
      return res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });
    }

    //비밀번호 최소 6자 이상 확인
    if (password.length < 6) {
      return res.status(406).json({ message: "비밀번호는 6자 이상입니다." });
    }

    if (!name) {
      return res.status(400).json({ message: "이름은 필수값입니다." });
    }

    const isExistUser = await prisma.users.findFirst({
      where: { email },
    });

    //이메일 중복되는지 확인
    if (isExistUser) {
      return res.status(409).json({ message: "이미 존재하는 이메일입니다." });
    }

    //비밀번호 hash 처리하여 데이터베이스 저장
    const hashedPassword = await bcrypt.hash(password, 10);
    //사용자 테이블 생성
    await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    return res.status(201).json({ message: "회원가입이 완료되었습니다." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "예기치 못한 에러가 발생하였습니다." });
  }
});

// ### **로그인 API**
// 1. 이메일, 비밀번호로 **로그인을 요청**합니다.
// 2. 이메일 또는 비밀번호 중 **하나라도 일치하지 않는다면,** 알맞은 Http Status Code와 에러 메세지를 반환해야 합니다.
// 3. **로그인 성공 시**, JWT AccessToken을 생성하여 반환합니다.
//     - Access Token
//         - Payload: userId를 담고 있습니다.
//         - 유효기한: 12시간
router.post("/sign-in", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ message: "이메일은 필수값입니다." });
    }

    if (!password) {
      return res.status(400).json({ message: "비밀번호는 필수값입니다." });
    }

    const user = await prisma.users.findFirst({
      where: { email },
    });

    //로그인한 이메일이 Users 테이블에 없는 경우
    if (!user) {
      return res.status(401).json({ message: "존재하지 않는 이메일입니다." });
    }

    //비밀번호가 일치하지 않는 경우
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "비밀번호가 일치하지 않습니다." });
    }

    //userId를 할당한 jwt를 'custom-secret-key'라는 비밀 키와 함께 생성, 유효기한 12시간
    const accessToken = jwt.sign(
      { userId: user.userId },
      process.env.ACCESS_TOKEN_SECRET_KEY,
      { expiresIn: "12h" },
    );
    //const refreshToken = jwt.sign({userId : user.userId}, env.REFRESH_TOKEN_SECRET_KEY, {expiresIn: "7d"});

    // tokenStorages[refreshToken] = {
    //   userId : user.userId,
    //   ip : req.ip,
    //   userAgent : req.headers['user-agent'],
    // }

    //쿠키에 해당하는 토큰 값 전달
    res.cookie("authorization", `Bearer ${accessToken}`);
    //res.cookie('refreshToken', refreshToken);

    return res.status(200).json({ message: "로그인에 성공하였습니다." });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "예기치 못한 에러가 발생하였습니다." });
  }
});

router.get("/users", authMiddleware, async (req, res, next) => {
  try {
    const { userId } = req.user;

    //인증에 성공하고, 비밀번호를 제외한 정보 반환
    const user = await prisma.users.findFirst({
      where: { userId: +userId },
      select: {
        userId: true,
        email: true,
        name: true,
      },
    });
    return res.status(200).json({ data: user });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "예기치 못한 에러가 발생하였습니다." });
  }
});

export default router;
