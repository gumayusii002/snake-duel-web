(() => {
  "use strict";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const COLS = 30, ROWS = 20, CELL = 30;
  const ROUND_SECONDS = 300;
  const COLORS = { orange: "#ff9b32", red: "#ff515b" };
  const DIRECTIONS = {
    ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 }, s: { x: 0, y: 1 },
    a: { x: -1, y: 0 }, d: { x: 1, y: 0 }
  };
  const OPPOSITE = { ArrowUp: "ArrowDown", ArrowDown: "ArrowUp", ArrowLeft: "ArrowRight", ArrowRight: "ArrowLeft",
    w: "s", s: "w", a: "d", d: "a" };

  let snakes, foods, bombs, running = false, paused = false, gameOver = false;
  let timeLeft = ROUND_SECONDS, lastTick = 0, accumulator = 0, raf = 0;
  let flash = 0;

  const same = (a, b) => a.x === b.x && a.y === b.y;
  const rand = (n) => Math.floor(Math.random() * n);
  function occupied(exceptFood = false) {
    const out = [];
    snakes?.forEach(s => s.body.forEach(p => out.push(p)));
    if (!exceptFood) foods?.forEach(f => out.push(f));
    bombs?.forEach(b => out.push(b));
    return out;
  }
  function randomCell() {
    const taken = occupied();
    for (let i = 0; i < 1000; i++) {
      const p = { x: rand(COLS), y: rand(ROWS) };
      if (!taken.some(q => same(p, q))) return p;
    }
    return { x: rand(COLS), y: rand(ROWS) };
  }
  function newSnake(id, color, body, dir) {
    return { id, color, body, dir, nextDir: dir, hp: 300, score: 0, alive: true };
  }
  function resetGame() {
    snakes = [
      newSnake(1, "orange", [{x:5,y:5},{x:4,y:5},{x:3,y:5}], {x:1,y:0}),
      newSnake(2, "red", [{x:24,y:14},{x:25,y:14},{x:26,y:14}], {x:-1,y:0})
    ];
    foods = []; bombs = [];
    for (let i = 0; i < 7; i++) foods.push({ ...randomCell(), size: 1 + rand(3) });
    for (let i = 0; i < 7; i++) bombs.push(randomCell());
    timeLeft = ROUND_SECONDS; running = true; paused = false; gameOver = false; accumulator = 0; lastTick = 0;
    $("overlay").classList.add("hidden");
    $("gameStatus").textContent = "Đang chơi";
    updateHud();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function setDirection(key) {
    if (!running || paused || gameOver) return;
    let s, d;
    if (key.startsWith("Arrow")) { s = snakes[0]; d = DIRECTIONS[key]; }
    else { s = snakes[1]; d = DIRECTIONS[key.toLowerCase()]; }
    if (!s || !d) return;
    if (d.x === -s.dir.x && d.y === -s.dir.y) return;
    s.nextDir = d;
  }
  document.addEventListener("keydown", (e) => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) e.preventDefault();
    if (e.key === " " && running && !gameOver) {
      paused = !paused;
      $("gameStatus").textContent = paused ? "Đã tạm dừng" : "Đang chơi";
      if (!paused) { lastTick = 0; raf = requestAnimationFrame(loop); }
      draw();
      return;
    }
    setDirection(e.key);
  });
  $("startBtn").addEventListener("click", resetGame);

  function spawnFood() {
    if (foods.length < 7) foods.push({ ...randomCell(), size: 1 + rand(3) });
  }
  function spawnBomb() {
    if (bombs.length < 7) bombs.push(randomCell());
  }
  function endGame(winner, message) {
    if (gameOver) return;
    gameOver = true; running = false;
    $("gameStatus").textContent = "Kết thúc";
    $("overlay").classList.remove("hidden");
    $("overlayTitle").textContent = winner === 0 ? "Hòa trận!" : `Rắn ${winner === 1 ? "cam" : "đỏ"} chiến thắng!`;
    $("overlayText").textContent = message;
    $("startBtn").textContent = "Chơi lại  →";
    draw();
  }
  function checkHealth() {
    const dead = snakes.filter(s => s.hp <= 0);
    if (dead.length) {
      dead.forEach(s => s.hp = 0);
      endGame(dead.length === 2 ? 0 : (dead[0].id === 1 ? 2 : 1),
        dead.length === 2 ? "Cả hai con rắn đều hết máu." : `Rắn ${dead[0].color === "orange" ? "cam" : "đỏ"} đã hết máu.`);
      return true;
    }
    return false;
  }
  function tick() {
    if (!running || paused || gameOver) return;
    timeLeft = Math.max(0, timeLeft - 1 / 8);
    const active = snakes.filter(s => s.alive);
    const heads = new Map();
    for (const s of active) {
      s.dir = s.nextDir;
      heads.set(s.id, { x: s.body[0].x + s.dir.x, y: s.body[0].y + s.dir.y });
    }

    const h1 = heads.get(1), h2 = heads.get(2);
    if (h1 && h2 && same(h1, h2)) {
      snakes.forEach(s => s.hp -= 100);
      if (checkHealth()) return;
      endGame(0, "Hai con rắn va đầu vào nhau cùng lúc.");
      return;
    }

    for (const s of active) {
      const h = heads.get(s.id);
      if (h.x < 0 || h.x >= COLS || h.y < 0 || h.y >= ROWS) {
        endGame(s.id === 1 ? 2 : 1, `Rắn ${s.color === "orange" ? "cam" : "đỏ"} đụng tường.`);
        return;
      }
      const opponent = snakes.find(q => q.id !== s.id);
      if (opponent.body.some(p => same(p, h))) {
        endGame(s.id, `Rắn ${s.color === "orange" ? "cam" : "đỏ"} đã ăn được đối thủ!`);
        return;
      }
      if (s.body.slice(0, -1).some(p => same(p, h))) {
        endGame(s.id === 1 ? 2 : 1, `Rắn ${s.color === "orange" ? "cam" : "đỏ"} tự đụng vào thân mình.`);
        return;
      }
    }

    for (const s of active) {
      const h = heads.get(s.id);
      s.body.unshift(h);
      const foodIndex = foods.findIndex(f => same(f, h));
      let grew = false;
      if (foodIndex >= 0) {
        const f = foods.splice(foodIndex, 1)[0];
        const score = {1: 200, 2: 250, 3: 300}[f.size];
        const heal = {1: 50, 2: 75, 3: 100}[f.size];
        s.score += score;
        s.hp = Math.min(500, s.hp + heal);
        grew = true;
        spawnFood();
        flash = 5;
      }
      const bombIndex = bombs.findIndex(b => same(b, h));
      if (bombIndex >= 0) {
        bombs.splice(bombIndex, 1);
        s.hp -= 100;
        spawnBomb();
        flash = 8;
      }
      if (!grew) s.body.pop();
    }
    if (checkHealth()) return;
    if (timeLeft <= 0) {
      const a = snakes[0], b = snakes[1];
      if (a.score !== b.score) endGame(a.score > b.score ? 1 : 2, `Hết 5 phút! Điểm: cam ${a.score} — đỏ ${b.score}.`);
      else if (a.hp !== b.hp) endGame(a.hp > b.hp ? 1 : 2, `Hòa điểm ${a.score}. Rắn ${a.hp > b.hp ? "cam" : "đỏ"} thắng nhờ nhiều HP hơn.`);
      else endGame(0, `Cả hai hòa nhau với ${a.score} điểm và ${a.hp} HP.`);
    }
    updateHud();
  }

  function updateHud() {
    $("score1").textContent = snakes[0].score;
    $("score2").textContent = snakes[1].score;
    $("hp1").textContent = snakes[0].hp;
    $("hp2").textContent = snakes[1].hp;
    $("bar1").style.width = `${snakes[0].hp / 5}%`;
    $("bar2").style.width = `${snakes[1].hp / 5}%`;
    const t = Math.ceil(timeLeft);
    $("timer").textContent = `${String(Math.floor(t / 60)).padStart(2,"0")}:${String(t % 60).padStart(2,"0")}`;
  }
  function roundedRect(x, y, w, h, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.roundRect(x, y, w, h, r); ctx.fill();
  }
  function draw() {
    ctx.fillStyle = "#182116"; ctx.fillRect(0,0,canvas.width,canvas.height);
    // classic checkerboard grass
    for (let y=0;y<ROWS;y++) for (let x=0;x<COLS;x++) {
      ctx.fillStyle = (x+y)%2===0 ? "#1b2818" : "#1e2b1b";
      ctx.fillRect(x*CELL,y*CELL,CELL,CELL);
      ctx.strokeStyle = "#283624"; ctx.lineWidth=1;
      ctx.strokeRect(x*CELL+.5,y*CELL+.5,CELL,CELL);
    }
    // food
    for (const f of foods || []) {
      const cx=f.x*CELL+CELL/2, cy=f.y*CELL+CELL/2, r=4+f.size*2;
      ctx.fillStyle="#8dd64d"; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#d6ff94"; ctx.beginPath(); ctx.arc(cx-r/3,cy-r/3,Math.max(2,r/3),0,Math.PI*2); ctx.fill();
      ctx.strokeStyle="#557e32";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx+2,cy-r);ctx.lineTo(cx+5,cy-r-5);ctx.stroke();
    }
    // bombs
    for (const b of bombs || []) {
      const cx=b.x*CELL+CELL/2,cy=b.y*CELL+CELL/2;
      ctx.fillStyle="#080b08";ctx.beginPath();ctx.arc(cx,cy,10,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#6d7770";ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle="#ff625c";ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#ffce62";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx+5,cy-7);ctx.lineTo(cx+10,cy-13);ctx.stroke();
    }
    // snakes
    for (const s of snakes || []) {
      s.body.forEach((p,i)=>{
        const inset=i===0?2:3;
        roundedRect(p.x*CELL+inset,p.y*CELL+inset,CELL-inset*2,CELL-inset*2,i===0?7:5,COLORS[s.color]);
        if(i===0){
          const eyeColor="#202016";
          let e1,e2;
          if(s.dir.x!==0){e1={x:p.x*CELL+CELL/2+s.dir.x*4,y:p.y*CELL+CELL/2-5};e2={x:p.x*CELL+CELL/2+s.dir.x*4,y:p.y*CELL+CELL/2+5};}
          else {e1={x:p.x*CELL+CELL/2-5,y:p.y*CELL+CELL/2+s.dir.y*4};e2={x:p.x*CELL+CELL/2+5,y:p.y*CELL+CELL/2+s.dir.y*4};}
          ctx.fillStyle=eyeColor;[e1,e2].forEach(e=>{ctx.beginPath();ctx.arc(e.x,e.y,2,0,Math.PI*2);ctx.fill();});
        } else {
          ctx.fillStyle="#ffffff1e";ctx.fillRect(p.x*CELL+6,p.y*CELL+6,5,5);
        }
      });
    }
    if (paused && !gameOver) {
      ctx.fillStyle="#0009";ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle="#fff";ctx.font="bold 42px Nunito, sans-serif";ctx.textAlign="center";ctx.fillText("TẠM DỪNG",canvas.width/2,canvas.height/2);
      ctx.font="18px Nunito, sans-serif";ctx.fillText("Nhấn Space để tiếp tục",canvas.width/2,canvas.height/2+35);
    }
  }
  function loop(timestamp) {
    if (!running || gameOver) { draw(); return; }
    if (!lastTick) lastTick = timestamp;
    const delta = Math.min(100, timestamp-lastTick); lastTick = timestamp;
    if (!paused) {
      accumulator += delta;
      const step = 1000/8;
      while (accumulator >= step) { tick(); accumulator -= step; if(gameOver) break; }
    }
    draw();
    if (running && !gameOver) raf = requestAnimationFrame(loop);
  }

  // Initial board preview
  snakes = [
    newSnake(1,"orange",[{x:5,y:5},{x:4,y:5},{x:3,y:5}],{x:1,y:0}),
    newSnake(2,"red",[{x:24,y:14},{x:25,y:14},{x:26,y:14}],{x:-1,y:0})
  ];
  foods=[];bombs=[];
  for(let i=0;i<7;i++)foods.push({...randomCell(),size:1+rand(3)});
  for(let i=0;i<7;i++)bombs.push(randomCell());
  updateHud();draw();
})();
