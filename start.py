import subprocess

def run_command():
    process = subprocess.Popen(
        ["cmd", "/c", "start.bat"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1  # Line-buffered
    )

    try:
        for line in process.stdout:
            print(line, end='')  # already includes newline
    except KeyboardInterrupt:
        print("\nStopping process...")
        process.terminate()
        process.wait()

if __name__ == "__main__":
    run_command()
