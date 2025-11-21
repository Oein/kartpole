import type { NotificationManager } from "./notifier";

function Leaderboard(props: {
  getGameRunning: () => boolean;
  notifier: NotificationManager;
  kvAPIKey: string;
}) {
  const drawer = document.createElement("div");
  drawer.id = "leaderboard-drawer";
  drawer.className = "drawer";

  const drawerContent = document.createElement("div");
  drawerContent.className = "drawer-content";

  const title = document.createElement("h2");
  title.id = "lbd-title";
  title.innerText = "리더보드";

  const leaderboardList = document.createElement("div");
  leaderboardList.id = "leaderboard-list";
  const loadingText = document.createElement("p");
  loadingText.className = "loading-text";
  loadingText.innerText = "점수를 불러오는 중...";
  leaderboardList.appendChild(loadingText);

  drawerContent.appendChild(title);
  drawerContent.appendChild(leaderboardList);
  drawer.appendChild(drawerContent);

  const drawerToggle = document.createElement("button");
  drawerToggle.id = "drawer-toggle";
  drawerToggle.className = "drawer-toggle";
  const toggleIcon = document.createElement("span");
  toggleIcon.className = "toggle-icon";
  toggleIcon.innerText = "›";
  drawerToggle.appendChild(toggleIcon);
  drawer.appendChild(drawerToggle);

  drawerToggle.addEventListener("click", () => {
    if (props.getGameRunning()) return drawer.classList.remove("open");
    drawer.classList.toggle("open");
  });

  // ESC 키로 드로어 닫기
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && drawer.classList.contains("open")) {
      drawer.classList.remove("open");
    }
  });

  document.body.appendChild(drawer);

  function showLeaderboard(lb: [string, number, string][]) {
    const list = leaderboardList;
    const scores = lb;
    list.innerHTML = ""; // 기존 내용 지우기

    console.log("Showing leaderboard:", scores);
    if (scores.length === 0) {
      const noDataItem = document.createElement("div");
      noDataItem.innerText = "저장된 점수가 없습니다.";
      noDataItem.style.textAlign = "center";
      list.appendChild(noDataItem);
      return;
    }

    scores.forEach(([name, score, additionalData], index) => {
      const listItem = document.createElement("div");
      const idnx = document.createElement("div");
      const nm = document.createElement("div");
      const scr = document.createElement("div");
      listItem.style.display = "flex";
      listItem.style.padding = "8px 0px";
      listItem.style.borderBottom = "1px solid #eee";
      if (index == scores.length - 1) {
        listItem.style.borderBottom = "none";
      }
      idnx.style.width = "2rem";
      idnx.style.marginRight = "10px";
      idnx.style.textAlign = "right";
      nm.style.flex = "1";
      scr.style.textAlign = "right";
      scr.style.display = "flex";
      scr.style.justifyContent = "flex-end";
      scr.style.alignItems = "flex-end";
      listItem.appendChild(idnx);
      listItem.appendChild(nm);
      listItem.appendChild(scr);
      idnx.innerText = `${index + 1}.`;
      nm.innerText = name;

      const scrSpan = document.createElement("span");
      const scrSpan2 = document.createElement("span");
      scrSpan.innerText = `${Math.floor(score)}점`;
      scrSpan2.style.color = "#888888a0";
      scrSpan2.style.fontSize = "0.8em";
      scrSpan2.style.fontWeight = "normal";
      scrSpan2.style.marginLeft = "4px";
      scrSpan2.innerText = `(${additionalData})`;
      scr.appendChild(scrSpan);
      scr.appendChild(scrSpan2);

      list.appendChild(listItem);

      if (index <= 2) {
        idnx.style.fontWeight = "bold";
        nm.style.fontWeight = "bold";
        scr.style.fontWeight = "bold";
      }

      if (index === 0) {
        idnx.innerText = "🥇";
        nm.style.color = "#ffb400";
        scr.style.color = "#ffb400";
      } else if (index === 1) {
        idnx.innerText = "🥈";
        nm.style.color = "#c0c0c0";
        scr.style.color = "#c0c0c0";
      } else if (index === 2) {
        idnx.innerText = "🥉";
        nm.style.color = "#cd7f32";
        scr.style.color = "#cd7f32";
      }
    });
  }
  async function fetchLeaderboard() {
    props.notifier.show("리더보드 불러오는중...");
    const data = await fetch(
      "https://oeinleaderboard.ert.im/lb?gameid=" + props.kvAPIKey
    ).then((res) => res.json());
    const dataTyped = data as {
      value: number | null;
      player: string | null;
      additionalInfo: string | null;
    }[];
    const lbData: [string, number, string][] = dataTyped.map((entry) => [
      entry.player || "익명",
      entry.value || 0,
      entry.additionalInfo || "",
    ]);
    showLeaderboard(lbData);
  }
  async function saveScore(
    name: string,
    score: number,
    additionalData: string
  ) {
    props.notifier.show("점수 저장중...");
    await fetch(`https://oeinleaderboard.ert.im/score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameid: props.kvAPIKey,
        player: name,
        value: score,
        addi: additionalData,
      }),
    }).then((res) => res.json());
    props.notifier.show("점수가 저장되었습니다!");
    await fetchLeaderboard();
  }

  fetchLeaderboard();

  return {
    saveScore,
    showLeaderboard,
    fetchLeaderboard,
  };
}

export default Leaderboard;
