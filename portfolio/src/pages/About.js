import Image from '../assets/me.gif';
import '../components/About.css'

export default function About() {
    return (
    <>
    <div className = 'flex'>
        <div className='mine'>
            <img src={Image} alt="ME" />
        </div>
        <h1 className ="text">
        On a mission to <b>crack the code hidden within data</b>, I thrive as both <b>a data scientist</b> and <b>a machine learning engineer</b>.
        I love the thrill of the hunt – <b>uncovering those hidden gems of insight</b> and using them to <b>build real-world solutions</b> that make a difference.
        But my skillset goes beyond the realm of data. I'm also a <b>dab hand at web development</b>, bringing <b>data visualizations to life</b>.
        When I'm not <b>wrangling datasets</b>, you might find me <b>flexing my creative muscles</b> with some <b>graphic design</b> or <b>crafting compelling video edits</b> to showcase my findings.
        In short, I'm passionate about <b>using data and creativity</b> to <b>push the boundaries</b> of what's possible.
        If you're looking for someone who can <b>bridge the gap</b> between <b>technical expertise</b> and <b>visual storytelling</b>, let's connect!
        </h1>
    </div>  
    </>
    );
}  