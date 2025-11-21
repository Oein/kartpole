const buttons = document.createElement("div");
buttons.id = "buttons";
buttons.style.position = "fixed";
buttons.style.top = "20px";
buttons.style.right = "20px";
buttons.style.zIndex = "1000";
buttons.style.display = "flex";
buttons.style.flexDirection = "row";
buttons.style.alignItems = "center";
buttons.style.gap = "10px";
document.body.appendChild(buttons);

export default function createButton(props: {
  onClick: (e: Event) => void;
  text: string;
  bgColor?: string;
  fgColor?: string;
}) {
  const btn = document.createElement("button");
  btn.id = "mode-change-button";
  btn.style.padding = "10px 20px";
  btn.style.backgroundColor = props.bgColor || "#2288dd";
  btn.style.color = props.fgColor || "white";
  btn.style.border = "none";
  btn.style.borderRadius = "5px";
  btn.style.cursor = "pointer";
  btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  btn.innerText = props.text;

  btn.addEventListener("click", props.onClick);

  buttons.appendChild(btn);
}
