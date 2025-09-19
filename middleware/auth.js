import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
    // const token = req.headers.authorization?.split(" ")[1];
    // const token = req.cookies.token;
    const authHeader = req.headers.authorization;
    // console.log(authHeader);
    

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.userEmail = decoded.email;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

export const verifyAdmin = (req,res,next) => {
    // if (req.userRole !== 'ADMIN') {
    //     return res.status(403).json({ message: "Forbidden: Admins only" });
    // }
    // next();


    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing token" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.userEmail = decoded.email;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
}