//Student table button interaction

const buttons = document.querySelectorAll(".stamp");

buttons.forEach(button =>{
    button.addEventListener("click", () =>{
        const group = button.parentElement;
        group.querySelectorAll(".stamp").forEach(btn =>{
            btn.setAttribute("aria-pressed", "false");
        });

        button.setAttribute("aria-pressed", "true");
    });
});
